import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SocketService, IncidentService, AuthService, ToastService, StudentService, TranslationService } from '../../core/services';
import { Incident, IncidentStatus, FlaggedStudent, StudentProfile, Student } from '../../core/models';
import { BehavioralDrawerComponent } from '../students/behavioral-drawer.component';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-guide-hud',
  standalone: true,
  imports: [CommonModule, FormsModule, BehavioralDrawerComponent, TranslatePipe],
  templateUrl: './guide-hud.component.html',
  styleUrl: './guide-hud.component.scss',
  styles: [`
    .guide-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #e2e8f0;
    }
    .guide-card--critical {
      background: #fff1f2;
      border-color: #fecdd3;
      border-left: 4px solid #ef4444;
    }
    .guide-card--completed {
      background: #f0fdf4;
      border-color: #bbf7d0;
      border-left: 4px solid #22c55e;
    }
    .guide-card--warning {
      background: #fffbeb;
      border-color: #fde68a;
      border-left: 4px solid #f97316;
    }
    .guide-card--active {
      background: #ffffff;
      border-color: #e2e8f0;
      border-left: 4px solid #3b82f6;
    }
    .guide-card--resolved {
      background: #f8fafc;
      border-color: #e2e8f0;
      border-left: 4px solid #94a3b8;
      opacity: 0.8;
    }
  `]
})
export class GuideHudComponent implements OnInit, OnDestroy {
  // Services via inject()
  readonly socketService = inject(SocketService);
  private readonly incidentService = inject(IncidentService);
  readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly studentService = inject(StudentService);
  readonly translationService = inject(TranslationService);

  // Timer for live updates
  private timerInterval: any;

  // Local state
  currentTime = signal<Date>(new Date());
  selectedFilter = signal<string>('all');
  sortBy = signal<'time' | 'status'>('time');
  confirmingIds = signal<Set<string>>(new Set());
  resolvingIds = signal<Set<string>>(new Set());

  // Flagged students panel state
  readonly flaggedStudents = this.studentService.flaggedStudents;
  showBehavioralDrawer = signal<boolean>(false);
  selectedStudentProfile = signal<StudentProfile | null>(null);
  drawerLoading = signal<boolean>(false);

  // Quick Add Search State
  showSearchModal = signal<boolean>(false);
  searchQuery = signal<string>('');
  searchResults = signal<Student[]>([]);
  searching = signal<boolean>(false);
  private searchSubject = new Subject<string>();

  // Effect: react to flag_resolved events and remove the student/action from the list
  private flagResolvedEffect = effect(() => {
    const event = this.socketService.lastFlagResolved();
    if (event) {
      this.studentService.removeFlaggedAction(event.triggeredActionId);
    }
  });

  // Read loading/error from services
  readonly loading = this.incidentService.loading;
  readonly error = this.incidentService.error;
  readonly connected = this.socketService.connected;

  // Stats computed from socketService (the single source of truth)
  readonly totalInTransit = this.socketService.totalInTransit;
  readonly overdueCount = this.socketService.overdueCount;
  readonly criticalCount = this.socketService.criticalCount;
  readonly resolvedCount = this.socketService.resolvedCount;

  // Computed: filtered and sorted incidents
  filteredIncidents = computed(() => {
    let incidents = this.socketService.liveIncidents().filter(i => i.category?.group !== 'PRAISE');
    
    // Filter by status
    const filter = this.selectedFilter();
    if (filter === 'active') {
      incidents = incidents.filter(i => i.status === IncidentStatus.DISPATCHED);
    } else if (filter === 'overdue') {
      incidents = incidents.filter(i => {
        if (i.status !== IncidentStatus.DISPATCHED) return false;
        return this.getMinutesSince(i.dispatchedAt) > 10;
      });
    } else if (filter === 'critical') {
      incidents = incidents.filter(i => 
        i.status === IncidentStatus.UNACCOUNTED || 
        (i.status === IncidentStatus.DISPATCHED && this.getMinutesSince(i.dispatchedAt) > 15)
      );
    } else if (filter === 'resolved') {
      incidents = incidents.filter(i =>
        i.status === IncidentStatus.RESOLVED || i.status === IncidentStatus.RECEIVED
      );
    }

    // Sort: UNACCOUNTED first, then DISPATCHED, then RESOLVED/RECEIVED at bottom
    return [...incidents].sort((a, b) => {
      const statusPriority = this.getStatusPriority(a.status) - this.getStatusPriority(b.status);
      if (statusPriority !== 0) return statusPriority;
      // Within same priority, sort by time (newest first)
      return new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime();
    });
  });

  ngOnInit(): void {
    // Connect to WebSocket for real-time updates
    this.socketService.connect();

    // Load initial incidents from API (today only)
    this.incidentService.getIncidents().subscribe({
      error: (err) => this.toastService.error(this.translationService.translate('common.error'))
    });

    // Load flagged students
    this.studentService.getFlaggedStudents().subscribe();

    // Start timer for live updates (updates currentTime every second)
    this.timerInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Setup search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (!query || query.length < 2) {
        this.searchResults.set([]);
        this.searching.set(false);
        return;
      }
      this.searching.set(true);
      this.studentService.searchStudents(query).subscribe({
        next: (students) => {
          this.searchResults.set(students);
          this.searching.set(false);
        },
        error: () => this.searching.set(false)
      });
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  logout(): void {
    this.socketService.disconnect();
    this.authService.logout();
  }

  // ── Flagged Student Drawer ──────────────────────────────────────────────
  openStudentDrawer(studentId: string): void {
    this.drawerLoading.set(true);
    this.showBehavioralDrawer.set(true);
    this.selectedStudentProfile.set(null);

    this.studentService.getStudentProfile(studentId).subscribe({
      next: (profile) => {
        this.selectedStudentProfile.set(profile);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
        this.toastService.error(this.translationService.translate('common.error'));
      },
    });
  }

  closeStudentDrawer(): void {
    this.showBehavioralDrawer.set(false);
    this.selectedStudentProfile.set(null);
  }

  // ── Quick Add Search ────────────────────────────────────────────────────
  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  openSearchModal(): void {
    this.showSearchModal.set(true);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  closeSearchModal(): void {
    this.showSearchModal.set(false);
  }

  selectStudent(studentId: string): void {
    this.closeSearchModal();
    this.openStudentDrawer(studentId);
  }

  onProfileRefresh(studentId: string): void {
    this.drawerLoading.set(true);
    this.studentService.getStudentProfile(studentId).subscribe({
      next: (profile) => {
        this.selectedStudentProfile.set(profile);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });
    // Also refresh flagged students list
    this.studentService.getFlaggedStudents().subscribe();
  }

  // Status priority for sorting (lower = higher priority = shown first)
  private getStatusPriority(status: IncidentStatus): number {
    switch (status) {
      case IncidentStatus.UNACCOUNTED: return 0;
      case IncidentStatus.DISPATCHED: return 1;
      case IncidentStatus.RECEIVED: return 2;
      case IncidentStatus.RESOLVED: return 2;
      default: return 3;
    }
  }

  // Confirm arrival - calls real API with optimistic UI
  confirmArrival(incident: Incident): void {
    // Add to confirming set
    this.confirmingIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(incident.id);
      return newIds;
    });
    
    // Optimistic update: immediately mark as received in UI
    this.socketService.updateIncidentStatus(incident.id, IncidentStatus.RECEIVED);

    this.incidentService.receiveIncident(incident.id).subscribe({
      next: () => {
        this.toastService.success(this.translationService.translate('guide.studentArrivedSafely'));
        // Remove from confirming set
        this.confirmingIds.update(ids => {
          const newIds = new Set(ids);
          newIds.delete(incident.id);
          return newIds;
        });
      },
      error: (err) => {
        // Rollback optimistic update on error
        this.socketService.updateIncidentStatus(incident.id, IncidentStatus.DISPATCHED);
        this.toastService.error(this.translationService.translate('common.error'));
        // Remove from confirming set
        this.confirmingIds.update(ids => {
          const newIds = new Set(ids);
          newIds.delete(incident.id);
          return newIds;
        });
      }
    });
  }

  // Resolve incident (manual alarm clearance)
  resolveIncident(incident: Incident): void {
    // Add to resolving set
    this.resolvingIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(incident.id);
      return newIds;
    });

    // Optimistic update: immediately mark as resolved in UI
    this.socketService.updateIncidentStatus(incident.id, IncidentStatus.RESOLVED, {
      resolvedAt: new Date()
    });

    this.incidentService.resolveIncident(incident.id).subscribe({
      next: () => {
        this.toastService.success(this.translationService.translate('guide.situationResolved'));
        this.resolvingIds.update(ids => {
          const newIds = new Set(ids);
          newIds.delete(incident.id);
          return newIds;
        });
      },
      error: (err) => {
        // Rollback optimistic update on error
        this.socketService.updateIncidentStatus(incident.id, IncidentStatus.UNACCOUNTED);
        this.toastService.error(this.translationService.translate('common.error'));
        this.resolvingIds.update(ids => {
          const newIds = new Set(ids);
          newIds.delete(incident.id);
          return newIds;
        });
      }
    });
  }

  isConfirming(incidentId: string): boolean {
    return this.confirmingIds().has(incidentId);
  }

  isResolving(incidentId: string): boolean {
    return this.resolvingIds().has(incidentId);
  }

  // Get minutes since dispatch
  getMinutesSince(dispatchedAt: Date | string): number {
    return Math.floor((Date.now() - new Date(dispatchedAt).getTime()) / 60000);
  }

  // Get timer display string (MM:SS format)
  getTimerDisplay(incident: Incident): string {
    if (incident.status === IncidentStatus.RECEIVED && incident.receivedAt) {
      const totalSeconds = Math.floor(
        (new Date(incident.receivedAt).getTime() - new Date(incident.dispatchedAt).getTime()) / 1000
      );
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    if (incident.status === IncidentStatus.RESOLVED && incident.resolvedAt) {
      const totalSeconds = Math.floor(
        (new Date(incident.resolvedAt).getTime() - new Date(incident.dispatchedAt).getTime()) / 1000
      );
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Live countdown for active incidents
    const totalSeconds = Math.floor((Date.now() - new Date(incident.dispatchedAt).getTime()) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Get status class for incident card
  getStatusClass(incident: Incident): Record<string, boolean> {
    const minutes = this.getMinutesSince(incident.dispatchedAt);

    if (incident.status === IncidentStatus.UNACCOUNTED) {
      return { 'guide-card': true, 'guide-card--critical': true };
    }
    if (incident.status === IncidentStatus.RESOLVED) {
      return { 'guide-card': true, 'guide-card--resolved': true };
    }
    if (incident.status === IncidentStatus.RECEIVED) {
      return { 'guide-card': true, 'guide-card--completed': true };
    }
    if (minutes > 15) {
      return { 'guide-card': true, 'guide-card--critical': true };
    }
    if (minutes > 10) {
      return { 'guide-card': true, 'guide-card--warning': true };
    }
    return { 'guide-card': true, 'guide-card--active': true };
  }

  // Progress bar style for timer track
  getProgressStyle(incident: Incident): string {
    const minutes = this.getMinutesSince(incident.dispatchedAt);
    const maxMinutes = 20; // 20 min = full bar
    const pct = Math.min((minutes / maxMinutes) * 100, 100);

    if (incident.status === IncidentStatus.RECEIVED) {
      return `height:100%; width:100%; background:#22c55e; border-radius:2px; transition:width 1s ease;`;
    }
    if (incident.status === IncidentStatus.RESOLVED) {
      return `height:100%; width:${pct}%; background:#94a3b8; border-radius:2px;`;
    }

    let color = '#3b82f6'; // blue default
    if (minutes > 15 || incident.status === IncidentStatus.UNACCOUNTED) {
      color = '#ef4444'; // red
    } else if (minutes > 10) {
      color = '#f97316'; // orange
    }

    return `height:100%; width:${pct}%; background:${color}; border-radius:2px; transition:width 1s ease;`;
  }

  // Get status badge
  getStatusBadge(incident: Incident): { text: string; class: string } {
    this.translationService.currentLang(); // reactive
    const isTr = this.translationService.currentLang() === 'tr';
    const minutes = this.getMinutesSince(incident.dispatchedAt);

    if (incident.status === IncidentStatus.UNACCOUNTED) {
      return { text: isTr ? 'KRİTİK' : 'CRITICAL', class: 'bg-red-600 text-white' };
    }
    if (incident.status === IncidentStatus.RESOLVED) {
      return { text: isTr ? 'ÇÖZÜMLENDİ' : 'RESOLVED', class: 'bg-slate-500 text-white' };
    }
    if (incident.status === IncidentStatus.RECEIVED) {
      return { text: isTr ? 'TAMAMLANDI' : 'COMPLETED', class: 'bg-green-600 text-white' };
    }
    if (minutes > 15) {
      return { text: isTr ? 'KRİTİK' : 'CRITICAL', class: 'bg-red-600 text-white' };
    }
    if (minutes > 10) {
      return { text: isTr ? 'UYARI' : 'WARNING', class: 'bg-orange-500 text-white' };
    }
    return { text: isTr ? 'AKTİF' : 'ACTIVE', class: 'bg-blue-600 text-white' };
  }

  // Get timer class based on status
  getTimerClass(incident: Incident): string {
    if (incident.status === IncidentStatus.RESOLVED) {
      return 'text-gray-400';
    }
    if (incident.status === IncidentStatus.RECEIVED) {
      return 'text-green-600';
    }
    
    const minutes = this.getMinutesSince(incident.dispatchedAt);
    
    if (incident.status === IncidentStatus.UNACCOUNTED || minutes > 15) {
      return 'text-red-600';
    }
    if (minutes > 10) {
      return 'text-orange-600';
    }
    return 'text-blue-600';
  }

  // Get timer suffix
  getTimerSuffix(incident: Incident): string {
    const isTr = this.translationService.currentLang() === 'tr';
    if (incident.status === IncidentStatus.RECEIVED) {
      return isTr ? 'Varış süresi' : 'Arrived in';
    }
    if (incident.status === IncidentStatus.RESOLVED) {
      return isTr ? 'Çözüm süresi' : 'Resolved after';
    }
    
    const minutes = this.getMinutesSince(incident.dispatchedAt);
    
    if (minutes > 15) {
      return isTr ? `Limit aşıldı (+${minutes - 15}dk)` : `Over limit (+${minutes - 15}m)`;
    }
    if (minutes > 10) {
      return isTr ? `Gecikmeli (+${minutes - 10}dk)` : `Slow (+${minutes - 10}m)`;
    }
    return isTr ? 'Zamanında' : 'On Track';
  }

  // Format time
  formatTime(date: Date): string {
    const isTr = this.translationService.currentLang() === 'tr';
    return date.toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: !isTr
    });
  }

  setFilter(filter: string): void {
    this.selectedFilter.set(filter);
  }

  toggleSort(): void {
    this.sortBy.update(s => s === 'time' ? 'status' : 'time');
  }

  // Refresh incidents manually
  refreshIncidents(): void {
    this.incidentService.refreshIncidents();
    this.toastService.info(this.translationService.translate('common.refresh'));
  }
}
