import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParentApiService, AuthService, ToastService, StudentSummary } from '../../core/services';
import { Incident, CategoryGroup, StudentProfileResponse } from '../../core/models';

type SortField = 'date' | 'category' | 'status';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-parent-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-portal.component.html',
  styleUrl: './parent-portal.component.scss'
})
export class ParentPortalComponent implements OnInit {
  private readonly parentApi = inject(ParentApiService);
  private readonly toastService = inject(ToastService);
  readonly authService = inject(AuthService);

  // State
  students = signal<StudentSummary[]>([]);
  selectedStudentId = signal<string>('');
  profile = signal<StudentProfileResponse | null>(null);
  incidents = signal<Incident[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  activeView = signal<'overview' | 'history' | 'rules'>('overview');
  rules = signal<any[]>([]);

  // Sorting
  sortField = signal<SortField>('date');
  sortDirection = signal<SortDirection>('desc');

  // Computed: semester stats
  totalIncidents = computed(() => this.profile()?.totalIncidents ?? 0);
  totalPraises = computed(() => this.profile()?.totalPraises ?? 0);
  semesterName = computed(() => this.profile()?.semesterName ?? 'Current Term');

  // Computed: behavior score (using profile score if available, otherwise fallback)
  behaviorScore = computed(() => this.profile()?.behaviorScore ?? 100);
  positivePercent = computed(() => this.profile()?.positivePercent ?? 50);

  // Computed: sorted incidents
  sortedIncidents = computed(() => {
    const list = [...this.incidents()];
    const field = this.sortField();
    const dir = this.sortDirection();
    const multiplier = dir === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      switch (field) {
        case 'date':
          return multiplier * (new Date(a.dispatchedAt).getTime() - new Date(b.dispatchedAt).getTime());
        case 'category':
          return multiplier * (a.category?.name || '').localeCompare(b.category?.name || '');
        case 'status':
          return multiplier * (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });
    return list;
  });

  // Computed: recent activity (last 5)
  recentActivity = computed(() => this.sortedIncidents().slice(0, 5));

  // Computed: recent achievements (last 3 positive rewards)
  recentAchievements = computed(() => {
    const achievements: any[] = [];
    this.incidents().forEach(inc => {
      if (inc.triggeredActions) {
        inc.triggeredActions.forEach((action: any) => {
          if (action.actionType === 'POSITIVE_REWARD') {
            achievements.push({
              ...action,
              incidentDate: inc.dispatchedAt,
              studentName: inc.student?.firstName
            });
          }
        });
      }
    });
    return achievements
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  });

  ngOnInit(): void {
    this.loadStudents();
    this.loadRules();
  }

  private loadRules(): void {
    this.parentApi.getRules().subscribe({
      next: (rules) => this.rules.set(rules),
      error: () => this.toastService.error('Failed to load school policies')
    });
  }

  private loadStudents(): void {
    this.loading.set(true);
    this.parentApi.getLinkedStudents().subscribe({
      next: (students) => {
        this.students.set(students);
        if (students.length > 0) {
          this.switchStudent(students[0].id!);
        } else {
          this.loading.set(false);
          this.error.set('No students linked to your account.');
        }
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set('Failed to load linked students.');
      }
    });
  }

  switchStudent(studentId: string): void {
    this.selectedStudentId.set(studentId);
    this.loadData(studentId);
  }

  private loadData(studentId: string): void {
    this.loading.set(true);
    this.error.set(null);

    // Load profile
    this.parentApi.getStudentProfile(studentId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loadHistory(studentId);
      },
      error: (err: any) => {
        this.loading.set(false);
        const msg = err.error?.message || 'Failed to load student data';
        this.error.set(msg);
        this.toastService.error(msg);
      }
    });
  }

  private loadHistory(studentId: string): void {
    this.parentApi.getIncidentHistory(studentId).subscribe({
      next: (incidents) => {
        this.incidents.set(incidents);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.toastService.error('Failed to load incident history');
      }
    });
  }

  setView(view: 'overview' | 'history' | 'rules'): void {
    this.activeView.set(view);
  }

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  getRelativeDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDate(date);
  }

  getCategoryClass(group?: CategoryGroup): string {
    return group === CategoryGroup.PRAISE
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700';
  }

  getCategoryIcon(group?: CategoryGroup): string {
    return group === CategoryGroup.PRAISE ? '⭐' : '⚠️';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'RESOLVED': return 'bg-green-100 text-green-700';
      case 'RECEIVED': return 'bg-blue-100 text-blue-700';
      case 'DISPATCHED': return 'bg-amber-100 text-amber-700';
      case 'UNACCOUNTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'RESOLVED': return 'Resolved';
      case 'RECEIVED': return 'Acknowledged';
      case 'DISPATCHED': return 'Pending';
      case 'UNACCOUNTED': return 'Unaccounted';
      default: return status;
    }
  }

  getActionTaken(incident: any): string {
    if (!incident.triggeredActions || incident.triggeredActions.length === 0) {
      return '—';
    }
    return incident.triggeredActions
      .map((ta: any) => ta.rule?.description || ta.actionType)
      .join(', ');
  }

  getScoreClass(): string {
    const score = this.behaviorScore();
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  }

  getScoreBarColor(): string {
    const score = this.behaviorScore();
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }

  logout(): void {
    this.authService.logout();
  }
}
