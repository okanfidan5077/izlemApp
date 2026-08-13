import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentProfile, TriggeredActionSummary, ResolutionOutcome, ActionStatus, InfractionCategory, CategoryGroup } from '../../core/models';
import { AuthService, CategoryService, IncidentService, ToastService, TranslationService } from '../../core/services';
import { StudentService } from '../../core/services/student.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-behavioral-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './behavioral-drawer.component.html',
  styleUrl: './behavioral-drawer.component.scss',
})
export class BehavioralDrawerComponent {
  @Input() profile: StudentProfile | null = null;
  @Input() loading = false;
  @Output() close = new EventEmitter<void>();
  @Output() profileRefresh = new EventEmitter<string>();

  readonly authService = inject(AuthService);
  readonly translationService = inject(TranslationService);
  private readonly studentService = inject(StudentService);
  private readonly categoryService = inject(CategoryService);
  private readonly incidentService = inject(IncidentService);
  private readonly toastService = inject(ToastService);

  // Behavior recording state
  showRecordModal = false;
  recordType: 'PRAISE' | 'INCIDENT' = 'PRAISE';
  selectedCategoryId = '';
  recordDescription = '';
  isSubmitting = false;
  categories: InfractionCategory[] = [];

  // Resolution modal state
  showResolutionModal = false;
  selectedAction: TriggeredActionSummary | null = null;
  resolutionOutcome: ResolutionOutcome = ResolutionOutcome.SUCCESSFUL;
  resolutionNote = '';
  resolving = false;

  readonly ResolutionOutcome = ResolutionOutcome;
  readonly ActionStatus = ActionStatus;

  readonly outcomeOptions = [
    { value: ResolutionOutcome.SUCCESSFUL, key: 'outcomes.SUCCESSFUL', defaultLabel: 'Successful', icon: '✅' },
    { value: ResolutionOutcome.DISMISSED, key: 'outcomes.DISMISSED', defaultLabel: 'Dismissed', icon: '🔕' },
    { value: ResolutionOutcome.LOW_ENGAGEMENT, key: 'outcomes.LOW_ENGAGEMENT', defaultLabel: 'Low Engagement', icon: '📉' },
    { value: ResolutionOutcome.ESCALATED, key: 'outcomes.ESCALATED', defaultLabel: 'Escalated', icon: '⬆️' },
    { value: ResolutionOutcome.NO_SHOW, key: 'outcomes.NO_SHOW', defaultLabel: 'No Show', icon: '❌' },
  ];

  // ── Pending Actions ──────────────────────────────────────────────────────
  get pendingActions(): TriggeredActionSummary[] {
    if (!this.profile?.triggeredActions) return [];
    return this.profile.triggeredActions.filter(a => a.status === ActionStatus.PENDING);
  }

  getActionTypeLabel(actionType: string): string {
    this.translationService.currentLang(); // reactive
    return this.translationService.translate('actionTypes.' + actionType);
  }

  // ── Open / Close Modal ─────────────────────────────────────────────────
  openResolveModal(action: TriggeredActionSummary): void {
    this.selectedAction = action;
    this.resolutionOutcome = ResolutionOutcome.SUCCESSFUL;
    this.resolutionNote = '';
    this.showResolutionModal = true;
  }

  closeResolveModal(): void {
    this.showResolutionModal = false;
    this.selectedAction = null;
    this.resolving = false;
  }

  // ── Submit Resolution ──────────────────────────────────────────────────
  submitResolution(): void {
    if (!this.selectedAction || !this.resolutionNote.trim()) return;
    this.resolving = true;

    this.studentService.resolveTriggeredAction(this.selectedAction.id, {
      resolutionOutcome: this.resolutionOutcome,
      resolutionNote: this.resolutionNote.trim(),
    }).subscribe({
      next: () => {
        this.closeResolveModal();
        // Refresh profile to reflect changes
        if (this.profile) {
          this.profileRefresh.emit(this.profile.id);
        }
      },
      error: () => {
        this.resolving = false;
      },
    });
  }

  // ── Behavior Recording ──────────────────────────────────────────────────
  openRecordModal(type: 'PRAISE' | 'INCIDENT'): void {
    this.recordType = type;
    this.selectedCategoryId = '';
    this.recordDescription = '';
    this.showRecordModal = true;
    this.loadCategories(type);
  }

  closeRecordModal(): void {
    this.showRecordModal = false;
  }

  private loadCategories(type: 'PRAISE' | 'INCIDENT'): void {
    const group = type === 'PRAISE' ? CategoryGroup.PRAISE : CategoryGroup.DISCIPLINE;
    this.categoryService.getCategoriesByGroup(group).subscribe(cats => {
      this.categories = cats.filter(c => c.isActive);
      if (this.categories.length > 0) {
        this.selectedCategoryId = this.categories[0].id;
      }
    });
  }

  submitBehavior(): void {
    if (!this.profile || !this.selectedCategoryId) return;

    this.isSubmitting = true;
    this.incidentService.createIncident({
      studentId: this.profile.id,
      categoryId: this.selectedCategoryId,
      description: this.recordDescription.trim(),
    }).subscribe({
      next: () => {
        const msgKey = this.recordType === 'PRAISE' ? 'drawer.recordPraise' : 'drawer.recordIncident';
        this.toastService.success(this.translationService.translate(msgKey));
        this.closeRecordModal();
        this.profileRefresh.emit(this.profile!.id);
        this.isSubmitting = false;
      },
      error: () => {
        this.toastService.error(this.translationService.translate('common.error'));
        this.isSubmitting = false;
      }
    });
  }

  // ── Doughnut Chart ─────────────────────────────────────────────────────────
  getDoughnutPaths(positivePercent: number): { praise: string; incident: string; cx: number; cy: number; r: number } {
    const cx = 80, cy = 80, r = 60, strokeWidth = 14;
    const circumference = 2 * Math.PI * r;
    const praiseDash = (positivePercent / 100) * circumference;
    const incidentDash = circumference - praiseDash;
    return { praise: `${praiseDash} ${incidentDash}`, incident: `${incidentDash} ${praiseDash}`, cx, cy, r };
  }

  // ── Relative Time ──────────────────────────────────────────────────────────
  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const isTr = this.translationService.currentLang() === 'tr';

    if (diffMins < 1) return isTr ? 'Az önce' : 'Just now';
    if (diffMins < 60) return isTr ? `${diffMins} dk önce` : `${diffMins} min ago`;
    if (diffHours < 24) return isTr ? `${diffHours} saat önce` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) {
      const time = date.toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      return isTr ? `Dün, ${time}` : `Yesterday, ${time}`;
    }
    return date.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
  }

  // ── Score Color ────────────────────────────────────────────────────────────
  getScoreColor(score: number): string {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }

  // ── Outcome Label ──────────────────────────────────────────────────────────
  getOutcomeLabel(outcome: string): string {
    this.translationService.currentLang(); // reactive
    const opt = this.outcomeOptions.find(o => o.value === outcome);
    const translatedText = this.translationService.translate('outcomes.' + outcome);
    return opt ? `${opt.icon} ${translatedText}` : outcome;
  }
}
