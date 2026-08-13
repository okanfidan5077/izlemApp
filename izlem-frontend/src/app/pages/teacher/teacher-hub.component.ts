import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { 
  IncidentService, 
  StudentService, 
  CategoryService,
  SocketService,
  AuthService,
  ToastService,
  TranslationService
} from '../../core/services';
import { 
  Incident, 
  Student, 
  InfractionCategory, 
  IncidentStatus,
  CategoryGroup,
  CreateIncidentRequest 
} from '../../core/models';

import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-teacher-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './teacher-hub.component.html'
})
export class TeacherHubComponent implements OnInit, OnDestroy {
  // Services via inject()
  private readonly incidentService = inject(IncidentService);
  private readonly studentService = inject(StudentService);
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  readonly socketService = inject(SocketService);
  readonly authService = inject(AuthService);
  readonly translationService = inject(TranslationService);

  // UI State
  isDrawerOpen = signal<boolean>(false);
  selectedFilter = signal<'all' | 'dispatched' | 'received' | 'praise'>('all');
  searchQuery = signal<string>('');
  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);

  // Form state for new log entry
  selectedStudents = signal<Student[]>([]);
  selectedCategory = signal<InfractionCategory | null>(null);
  isLessonTerminated = signal<boolean>(false);
  isClassTerminated = signal<boolean>(false);
  notes = signal<string>('');
  selectedType = signal<'discipline' | 'praise'>('discipline');
  studentSearchQuery = signal<string>('');

  // Student search results
  searchResults = signal<Student[]>([]);
  showSearchResults = signal<boolean>(false);

  // Read loading states from services
  readonly loading = computed(() => 
    this.incidentService.loading() || this.studentService.loading() || this.categoryService.loading()
  );

  // Computed: filtered incidents from SocketService (the single source of truth)
  filteredIncidents = computed(() => {
    let incidents = this.socketService.liveIncidents();
    const filter = this.selectedFilter();
    const query = this.searchQuery().toLowerCase();

    // Filter by status
    if (filter === 'dispatched') {
      incidents = incidents.filter(i => i.status === IncidentStatus.DISPATCHED);
    } else if (filter === 'received') {
      incidents = incidents.filter(i => i.status === IncidentStatus.RECEIVED && i.category?.group !== CategoryGroup.PRAISE);
    } else if (filter === 'praise') {
      incidents = incidents.filter(i => i.category?.group === CategoryGroup.PRAISE);
    }

    // Filter by search query
    if (query) {
      incidents = incidents.filter(i => 
        i.student?.firstName?.toLowerCase().includes(query) ||
        i.student?.lastName?.toLowerCase().includes(query) ||
        i.category?.name?.toLowerCase().includes(query)
      );
    }

    // Sort by most recent first
    return [...incidents].sort((a, b) => 
      new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime()
    );
  });

  // Computed: categories from service signals
  readonly disciplineCategories = computed(() => 
    this.categoryService.disciplineCategories()
  );
  
  readonly praiseCategories = computed(() => 
    this.categoryService.praiseCategories()
  );

  // Current categories based on selected type
  currentCategories = computed(() => 
    this.selectedType() === 'discipline' ? this.disciplineCategories() : this.praiseCategories()
  );

  ngOnInit(): void {
    // Connect to WebSocket for real-time updates
    this.socketService.connect();

    // Load initial data from API
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    // WebSocket stays connected for other pages that might use it
  }

  private loadInitialData(): void {
    // Load incidents - will populate socketService.liveIncidents
    this.incidentService.getIncidents().subscribe({
      error: (err) => this.toastService.error('Failed to load incidents')
    });

    // Load students for search
    this.studentService.getStudents().subscribe({
      error: (err) => this.toastService.error('Failed to load students')
    });

    // Load categories for the log drawer
    this.categoryService.getCategories().subscribe({
      error: (err) => this.toastService.error('Failed to load categories')
    });
  }

  // Drawer
  openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.resetForm();
  }

  // Form methods
  resetForm(): void {
    this.selectedStudents.set([]);
    this.selectedCategory.set(null);
    this.isLessonTerminated.set(false);
    this.isClassTerminated.set(false);
    this.notes.set('');
    this.studentSearchQuery.set('');
    this.searchResults.set([]);
    this.submitError.set(null);
  }

  // Student search - uses cached students from service
  onStudentSearch(query: string): void {
    this.studentSearchQuery.set(query);
    
    if (query.length < 2) {
      this.searchResults.set([]);
      this.showSearchResults.set(false);
      return;
    }

    const selectedIds = new Set(this.selectedStudents().map(s => s.id));

    // Search from cached students, excluding already-selected
    const results = this.studentService.getCachedStudents().filter(s =>
      !selectedIds.has(s.id) &&
      (`${s.firstName} ${s.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
      s.studentNo.includes(query))
    ).slice(0, 5);

    this.searchResults.set(results);
    this.showSearchResults.set(true);
  }

  selectStudent(student: Student): void {
    const current = this.selectedStudents();
    if (!current.find(s => s.id === student.id)) {
      this.selectedStudents.set([...current, student]);
    }
    this.studentSearchQuery.set('');
    this.searchResults.set([]);
    this.showSearchResults.set(false);
  }

  removeStudent(studentId: string): void {
    this.selectedStudents.update(list => list.filter(s => s.id !== studentId));
  }

  selectCategory(category: InfractionCategory): void {
    this.selectedCategory.set(category);
  }

  toggleLessonTerminated(): void {
    this.isLessonTerminated.update(v => {
      const next = !v;
      if (!next) {
        this.isClassTerminated.set(false);
      }
      return next;
    });
  }

  toggleClassTerminated(): void {
    this.isClassTerminated.update(v => {
      const next = !v;
      if (next) {
        this.isLessonTerminated.set(true);
      }
      return next;
    });
  }

  setType(type: 'discipline' | 'praise'): void {
    this.selectedType.set(type);
    this.selectedCategory.set(null);
  }

  // Submit incident - calls real API (one per selected student)
  submitIncident(): void {
    const students = this.selectedStudents();
    const category = this.selectedCategory();

    if (students.length === 0 || !category) {
      this.toastService.warning('Please select at least one student and a category');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const requests = students.map(student => {
      const request: CreateIncidentRequest = {
        studentId: student.id,
        categoryId: category.id,
        description: this.isClassTerminated()
          ? 'Class terminated — Teacher left class'
          : (this.isLessonTerminated() ? 'Student removed from class' : undefined),
        notes: this.notes() || undefined,
        isLessonTerminated: this.isLessonTerminated(),
        isClassTerminated: this.isClassTerminated()
      };
      return this.incidentService.createIncident(request);
    });

    forkJoin(requests).subscribe({
      next: (incidents) => {
        this.isSubmitting.set(false);
        const count = incidents.length;
        const label = count === 1
          ? `Incident logged for ${students[0].firstName} ${students[0].lastName}`
          : `${count} incidents logged successfully`;
        this.toastService.success(label);
        this.closeDrawer();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.error?.message || 'Failed to log one or more incidents');
        this.submitError.set(err.error?.message || 'Failed to log one or more incidents');
      }
    });
  }

  setFilter(filter: 'all' | 'dispatched' | 'received' | 'praise'): void {
    this.selectedFilter.set(filter);
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  getStatusBadgeClass(incident: Incident): string {
    if (incident.category?.group === CategoryGroup.PRAISE) {
      return 'badge-praise';
    }
    switch (incident.status) {
      case IncidentStatus.DISPATCHED: return 'badge-dispatched';
      case IncidentStatus.RECEIVED: return 'badge-received';
      case IncidentStatus.UNACCOUNTED: return 'badge-unaccounted';
      default: return 'badge-dispatched';
    }
  }

  getStatusText(incident: Incident): string {
    this.translationService.currentLang(); // reactive
    if (incident.category?.group === CategoryGroup.PRAISE) {
      return this.translationService.translate('drawer.praise');
    }
    switch (incident.status) {
      case IncidentStatus.DISPATCHED:
        return this.translationService.translate('guide.statusDispatched');
      case IncidentStatus.RECEIVED:
        return this.translationService.translate('guide.statusReceived');
      case IncidentStatus.RESOLVED:
        return this.translationService.translate('guide.statusResolved');
      case IncidentStatus.UNACCOUNTED:
        return this.translationService.translate('guide.statusUnaccounted');
      default:
        return incident.status;
    }
  }

  getCategoryIcon(category: InfractionCategory): string {
    const name = category.name.toLowerCase();
    if (name.includes('tardy') || name.includes('late')) return '⏰';
    if (name.includes('disrupt')) return '😤';
    if (name.includes('homework')) return '📝';
    if (name.includes('uniform')) return '👔';
    if (name.includes('phone')) return '📱';
    if (name.includes('aggress') || name.includes('fight')) return '⚠️';
    if (name.includes('excel') || name.includes('praise') || name.includes('positive')) return '⭐';
    if (name.includes('help') || name.includes('assist')) return '🤝';
    return '📋';
  }

  // Logout
  logout(): void {
    this.authService.logout();
  }
}
