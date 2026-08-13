import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryService, CreateCategoryRequest, CreateRuleRequest, ToastService, AuthService, AdminApiService, TranslationService } from '../../core/services';
import { InfractionCategory, DisciplineRule, CategoryGroup, User, UserRole, ActionType, TriggeredAction, SemesterConfig, RuleTriggeredEvent, ActionStatus, DashboardStats, OutcomeStatsItem, IncidentTrendItem, TopCategoryItem } from '../../core/models';
import { SocketService } from '../../core/services/socket.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly adminApi = inject(AdminApiService);
  private readonly socketService = inject(SocketService);
  readonly authService = inject(AuthService);
  readonly translationService = inject(TranslationService);
  protected readonly Math = Math;

  // ==================== SECTION NAV ====================
  adminSection = signal<'dashboard' | 'categories' | 'users' | 'settings'>('dashboard');

  // ==================== USERS STATE ====================
  users = signal<User[]>([]);
  usersLoading = signal<boolean>(false);
  userSearch = signal<string>('');
  userStatusFilter = signal<string>('');
  
  // Password Reset Modal
  showResetModal = signal<boolean>(false);
  resetTargetUser = signal<User | null>(null);
  resetPassword = signal<string>('');
  resettingPassword = signal<boolean>(false);

  // Filtered users
  filteredUsers = computed(() => {
    const search = this.userSearch().toLowerCase();
    const status = this.userStatusFilter(); // 'active', 'pending', or ''
    
    return this.users().filter(u => {
      const matchesSearch = !search || 
        u.firstName.toLowerCase().includes(search) || 
        u.lastName.toLowerCase().includes(search) || 
        u.email.toLowerCase().includes(search);
        
      const matchesStatus = !status || 
        (status === 'active' && u.isActive) || 
        (status === 'pending' && !u.isActive);

      return matchesSearch && matchesStatus;
    });
  });

  // User Helpers
  getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case UserRole.ADMIN: return 'bg-purple-100 text-purple-800';
      case UserRole.TEACHER: return 'bg-blue-100 text-blue-800';
      case UserRole.GUIDE_TEACHER: return 'bg-green-100 text-green-800';
      case UserRole.PARENT: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getRoleLabel(role: UserRole): string {
    this.translationService.currentLang(); // reactive
    return this.translationService.translate('roles.' + role);
  }

  activateUser(user: User) {
    this.toggleUserStatus(user);
  }

  deactivateUser(user: User) {
    this.toggleUserStatus(user);
  }

  // Category Helpers
  openCategoryModal() {
    this.openCreateCategoryModal();
  }
  
  toggleCategoryActive() {
    const cat = this.selectedCategory();
    if(cat) this.toggleCategoryStatus(cat);
  }

  getRulesCount(category: InfractionCategory): number {
    return this.allRules().filter(r => r.categoryId === category.id).length;
  }

  setTab(tab: 'infractions' | 'praise') {
    this.setActiveTab(tab);
  }

  updateSearch(term: string) {
    this.searchQuery.set(term);
  }

  // Action helpers (FIXED ENUM)
  getActionTypeBadgeClass(type: ActionType): string {
    switch (type) {
      case ActionType.LOG_WARNING: return 'bg-yellow-100 text-yellow-800';
      case ActionType.NOTIFY_PARENT: return 'bg-orange-100 text-orange-800';
      case ActionType.ASSIGN_DETENTION: return 'bg-red-100 text-red-800';
      case ActionType.REQUIRE_ADMIN_MEETING: return 'bg-red-200 text-red-900';
      case ActionType.POSITIVE_REWARD: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getActionTypeIcon(type: ActionType): string {
    switch (type) {
      case ActionType.LOG_WARNING: return '⚠️';
      case ActionType.NOTIFY_PARENT: return '📧';
      case ActionType.ASSIGN_DETENTION: return '🛑';
      case ActionType.REQUIRE_ADMIN_MEETING: return '👨‍🏫';
      case ActionType.POSITIVE_REWARD: return '⭐';
      default: return '📝';
    }
  }

  getActionTypeLabel(type: ActionType): string {
    this.translationService.currentLang(); // reactive
    return this.translationService.translate('actionTypes.' + type);
  }

  getOutcomeLabel(outcome: string): string {
    this.translationService.currentLang(); // reactive
    return this.translationService.translate('outcomes.' + outcome);
  }

  selectedCategory = signal<InfractionCategory | null>(null);
  selectedRules = signal<DisciplineRule[]>([]);
  activeTab = signal<'infractions' | 'praise'>('infractions');
  searchQuery = signal<string>('');

  // Modal states
  showCategoryModal = signal<boolean>(false);
  showRuleModal = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isTogglingActive = signal<boolean>(false);

  // Category form
  newCategoryName = signal<string>('');
  newCategoryPoints = signal<number>(5);

  // Rule form
  newRuleThreshold = signal<number>(1);
  newRuleDescription = signal<string>('');
  newRuleActionType = signal<ActionType>(ActionType.LOG_WARNING);
  
  readonly actionTypeOptions = [
    { value: ActionType.LOG_WARNING, key: 'actionTypes.LOG_WARNING' },
    { value: ActionType.NOTIFY_PARENT, key: 'actionTypes.NOTIFY_PARENT' },
    { value: ActionType.ASSIGN_DETENTION, key: 'actionTypes.ASSIGN_DETENTION' },
    { value: ActionType.REQUIRE_ADMIN_MEETING, key: 'actionTypes.REQUIRE_ADMIN_MEETING' },
    { value: ActionType.POSITIVE_REWARD, key: 'actionTypes.POSITIVE_REWARD' },
  ];

  // Read from service signals
  readonly categories = this.categoryService.categories;
  readonly allRules = this.categoryService.rules;
  readonly loading = this.categoryService.loading;
  readonly error = this.categoryService.error;
  readonly CategoryGroup = CategoryGroup;
  readonly ActionType = ActionType;
  readonly ActionStatus = ActionStatus;

  // Filtered categories
  filteredCategories = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().toLowerCase();
    const group = tab === 'infractions' ? CategoryGroup.DISCIPLINE : CategoryGroup.PRAISE;

    return this.categories()
      .filter(c => c.group === group && c.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // ==================== DASHBOARD STATE ====================
  stats = signal<DashboardStats>({ activeStudents: 0, pendingApprovals: 0, criticalIncidents: 0 });
  triggeredActions = signal<TriggeredAction[]>([]);
  statsLoading = signal<boolean>(false);
  actionsLoading = signal<boolean>(false);

  // ==================== ANALYTICS STATE ====================
  outcomeStats = signal<OutcomeStatsItem[]>([]);
  incidentTrends = signal<IncidentTrendItem[]>([]);
  topCategories = signal<TopCategoryItem[]>([]);
  analyticsLoading = signal<boolean>(false);
  drilldownOutcome = signal<string | null>(null);

  // Outcome color palette
  readonly OUTCOME_COLORS: Record<string, string> = {
    SUCCESSFUL: '#10b981',
    LOW_ENGAGEMENT: '#f59e0b',
    ESCALATED: '#ef4444',
    DISMISSED: '#6b7280',
    NO_SHOW: '#8b5cf6',
  };

  // Bar chart color palette
  readonly BAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308'];

  // Computed: success rate percentage
  successRate = computed(() => {
    const stats = this.outcomeStats();
    const total = stats.reduce((s, i) => s + i.count, 0);
    if (total === 0) return 0;
    const successful = stats.find(i => i.outcome === 'SUCCESSFUL')?.count || 0;
    return Math.round((successful / total) * 100);
  });

  // Computed: total resolved count
  totalResolved = computed(() => {
    return this.outcomeStats().reduce((s, i) => s + i.count, 0);
  });

  // Computed: SVG doughnut arc paths
  doughnutArcs = computed(() => {
    const stats = this.outcomeStats();
    const total = stats.reduce((s, i) => s + i.count, 0);
    this.translationService.currentLang(); // reactive
    if (total === 0) return [];

    const cx = 100, cy = 100, r = 80;
    let startAngle = -90; // Start from top
    const arcs: { path: string; color: string; outcome: string; label: string; count: number; percent: number }[] = [];

    for (const item of stats) {
      const percent = item.count / total;
      const sweepAngle = percent * 360;
      const endAngle = startAngle + sweepAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = sweepAngle > 180 ? 1 : 0;

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      arcs.push({
        path,
        color: this.OUTCOME_COLORS[item.outcome] || '#94a3b8',
        outcome: item.outcome,
        label: this.translationService.translate('outcomes.' + item.outcome),
        count: item.count,
        percent: Math.round(percent * 100),
      });

      startAngle = endAngle;
    }

    return arcs;
  });

  // Computed: max category count for bar scaling
  maxCategoryCount = computed(() => {
    const cats = this.topCategories();
    if (cats.length === 0) return 1;
    return Math.max(...cats.map(c => c.count));
  });

  // Computed: SVG line chart points
  trendLinePoints = computed(() => {
    const data = this.incidentTrends();
    if (data.length === 0) return '';

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const width = 500;
    const height = 160;
    const padding = 20;

    const points = data.map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
      const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return points.join(' ');
  });

  // Computed: trend area path for filled area under line
  trendAreaPath = computed(() => {
    const data = this.incidentTrends();
    if (data.length === 0) return '';

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const width = 500;
    const height = 160;
    const padding = 20;

    const points = data.map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
      const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
      return { x, y };
    });

    let path = `M ${points[0].x} ${height - padding}`;
    for (const p of points) {
      path += ` L ${p.x} ${p.y}`;
    }
    path += ` L ${points[points.length - 1].x} ${height - padding} Z`;
    return path;
  });

  // Computed: trend data point circles
  trendDataPoints = computed(() => {
    const data = this.incidentTrends();
    if (data.length === 0) return [];

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const width = 500;
    const height = 160;
    const padding = 20;

    return data.map((d, i) => ({
      x: padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding),
      y: height - padding - (d.count / maxCount) * (height - 2 * padding),
      date: d.date,
      count: d.count,
    }));
  });

  // Computed: max trend count for y-axis labels
  maxTrendCount = computed(() => {
    const data = this.incidentTrends();
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.count));
  });

  // Computed: filtered triggered actions (by drilldown outcome)
  filteredTriggeredActions = computed(() => {
    const drilldown = this.drilldownOutcome();
    const actions = this.triggeredActions();
    if (!drilldown) return actions;
    return actions.filter(a => a.resolutionOutcome === drilldown);
  });

  constructor() {
    this.listenForRuleTriggered();
    this.listenForFlagResolved();
  }

  ngOnInit() {
    this.categoryService.refresh();
    this.loadDashboardData();
    this.loadTriggeredActions();
    this.loadUsers();
    this.loadAnalytics();
  }

  ngOnDestroy() {
    // Cleanup handled by signals/effects
  }

  setSection(section: 'dashboard' | 'categories' | 'users' | 'settings') {
    this.adminSection.set(section);
  }

  logout() {
    this.authService.logout();
  }

  // ==================== USER MANAGEMENT ====================
  loadUsers() {
    this.adminApi.getUsers(this.userSearch(), this.userStatusFilter()).subscribe({
      next: (data) => this.users.set(data),
      error: () => this.toastService.error('Failed to load users')
    });
  }

  filterUsers() {
    this.loadUsers();
  }

  toggleUserStatus(user: User) {
    if(!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} this user?`)) return;
    
    this.adminApi.setUserStatus(user.id, !user.isActive).subscribe({
      next: (updated) => {
        this.toastService.success(`User ${updated.isActive ? 'activated' : 'deactivated'}`);
        this.users.update(list => list.map(u => u.id === user.id ? updated : u));
      },
      error: () => this.toastService.error('Failed to update user status')
    });
  }

  deleteUser(user: User) {
    if(!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

    this.adminApi.deleteUser(user.id).subscribe({
      next: () => {
        this.toastService.success('User deleted');
        this.users.update(list => list.filter(u => u.id !== user.id));
      },
      error: () => this.toastService.error('Failed to delete user')
    });
  }

  openResetModal(user: User) {
    this.resetTargetUser.set(user);
    this.resetPassword.set('');
    this.showResetModal.set(true);
  }

  closeResetModal() {
    this.showResetModal.set(false);
    this.resetTargetUser.set(null);
  }

  submitResetPassword() {
    const user = this.resetTargetUser();
    const pass = this.resetPassword();
    if(!user || !pass || pass.length < 8) return;

    this.resettingPassword.set(true);
    this.adminApi.resetUserPassword(user.id, pass).subscribe({
      next: () => {
        this.toastService.success('Password reset successfully');
        this.closeResetModal();
        this.resettingPassword.set(false);
      },
      error: () => {
        this.toastService.error('Failed to reset password');
        this.resettingPassword.set(false);
      }
    });
  }


  // ==================== CATEGORIES ====================
  selectCategory(category: InfractionCategory) {
    this.selectedCategory.set(category);
    const rules = this.allRules().filter(r => r.categoryId === category.id);
    this.selectedRules.set(rules);
  }

  setActiveTab(tab: 'infractions' | 'praise') {
    this.activeTab.set(tab);
    this.selectedCategory.set(null);
  }

  openCreateCategoryModal() {
    this.selectedCategory.set(null); 
    this.newCategoryName.set('');
    this.newCategoryPoints.set(5);
    this.showCategoryModal.set(true);
  }

  closeCategoryModal() {
    this.showCategoryModal.set(false);
  }

  submitCategory() {
    if (!this.newCategoryName()) return;

    const group = this.activeTab() === 'infractions' ? CategoryGroup.DISCIPLINE : CategoryGroup.PRAISE;
    const req: CreateCategoryRequest = {
      name: this.newCategoryName(),
      points: this.newCategoryPoints(),
      group
    };

    this.isSubmitting.set(true);
    this.categoryService.createCategory(req).subscribe({
      next: () => {
        this.toastService.success('Category created');
        this.closeCategoryModal();
        this.isSubmitting.set(false);
      },
      error: () => {
        this.toastService.error('Failed to create category');
        this.isSubmitting.set(false);
      }
    });
  }

  toggleCategoryStatus(category: InfractionCategory) {
    if (this.isTogglingActive()) return;
    this.isTogglingActive.set(true);
    
    this.categoryService.toggleCategory(category.id).subscribe({
      next: () => {
         this.toastService.success(category.isActive ? 'Category deactivated' : 'Category activated');
         this.isTogglingActive.set(false);
      },
      error: () => {
        this.toastService.error('Failed to update category');
        this.isTogglingActive.set(false);
      }
    });
  }

  // ==================== RULES ====================
  openRuleModal() {
    this.newRuleDescription.set('');
    this.newRuleThreshold.set(1);
    this.newRuleActionType.set(ActionType.LOG_WARNING);
    this.showRuleModal.set(true);
  }

  closeRuleModal() {
    this.showRuleModal.set(false);
  }

  submitRule() {
    const cat = this.selectedCategory();
    if (!cat) return;

    const req: CreateRuleRequest = {
      categoryId: cat.id,
      description: this.newRuleDescription(),
      actionType: this.newRuleActionType(),
      threshold: this.newRuleThreshold()
    };

    this.isSubmitting.set(true);
    this.categoryService.createRule(req).subscribe({
      next: () => {
        this.toastService.success('Rule created');
        this.closeRuleModal();
        setTimeout(() => this.selectCategory(cat), 100); 
        this.isSubmitting.set(false);
      },
      error: () => {
        this.toastService.error('Failed to create rule');
        this.isSubmitting.set(false);
      }
    });
  }

  deleteRule(rule: DisciplineRule) {
    if(!confirm('Delete this rule?')) return;

    this.categoryService.deleteRule(rule.id).subscribe({
      next: () => {
        this.toastService.success('Rule deleted');
        const cat = this.selectedCategory();
        if(cat) setTimeout(() => this.selectCategory(cat), 100);
      },
      error: () => this.toastService.error('Failed to delete rule')
    });
  }

  // ==================== SEMESTER MANAGEMENT ====================
  semester = signal<SemesterConfig | null>(null);
  semesterName = signal<string>('');
  semesterStartDate = signal<string>('');
  semesterEndDate = signal<string>('');
  savingSemester = signal<boolean>(false);

  loadDashboardData() {
    this.statsLoading.set(true);
    // Load stats
    this.adminApi.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false)
    });

    // Load current semester
    this.adminApi.getCurrentSemester().subscribe({
      next: (sem) => {
        this.semester.set(sem);
        if (sem) {
          this.semesterName.set(sem.name);
          // Format dates for input[type="date"] (YYYY-MM-DD)
          this.semesterStartDate.set(new Date(sem.startDate).toISOString().split('T')[0]);
          this.semesterEndDate.set(new Date(sem.endDate).toISOString().split('T')[0]);
        }
      }
    });
  }

  saveSemester() {
    if (!this.semesterName() || !this.semesterStartDate() || !this.semesterEndDate()) return;

    this.savingSemester.set(true);
    this.adminApi.saveSemester({
      name: this.semesterName(),
      startDate: this.semesterStartDate(),
      endDate: this.semesterEndDate()
    }).subscribe({
      next: (sem) => {
        this.semester.set(sem);
        this.toastService.success('Semester updated successfully');
        this.savingSemester.set(false);
      },
      error: () => {
        this.toastService.error('Failed to save semester');
        this.savingSemester.set(false);
      }
    });
  }

  // ==================== DASHBOARD & ACTIONS ====================
  loadTriggeredActions(): void {
    this.actionsLoading.set(true);
    this.adminApi.getTriggeredActions().subscribe({
      next: (data) => {
        this.triggeredActions.set(data);
        this.actionsLoading.set(false);
      },
      error: () => {
        this.actionsLoading.set(false);
        this.toastService.error('Failed to load triggered actions');
      }
    });
  }

  cancelAction(action: TriggeredAction): void {
    if (!confirm('Are you sure you want to cancel this action? It will not be processed.')) return;

    this.adminApi.cancelTriggeredAction(action.id).subscribe({
      next: () => {
        this.toastService.success('Action cancelled successfully');
        this.triggeredActions.update(actions => 
          actions.map(a => a.id === action.id ? { ...a, status: ActionStatus.CANCELLED } : a)
        );
      },
      error: (err: any) => {
        console.error(err);
        this.toastService.error('Failed to cancel action');
      }
    });
  }

  private listenForRuleTriggered(): void {
    effect(() => {
      const event = this.socketService.lastRuleTriggered();
      if (!event) return;

      const newAction: TriggeredAction = {
        id: event.triggeredActionId,
        actionType: event.actionType,
        status: ActionStatus.PENDING,
        count: event.count,
        createdAt: event.timestamp,
        studentId: '',
        student: { id: '', firstName: event.studentName.split(' ')[0], lastName: event.studentName.split(' ').slice(1).join(' '), studentNo: '' },
        ruleId: '',
        rule: { id: '', description: event.description, actionType: event.actionType, threshold: event.threshold, isActive: true, schoolId: '', categoryId: '', createdAt: new Date(), updatedAt: new Date(), category: { id: '', name: event.categoryName, group: CategoryGroup.DISCIPLINE, points: 0, isActive: true, schoolId: '', createdAt: new Date(), updatedAt: new Date() } },
        incidentId: '',
        schoolId: '',
      };
      this.triggeredActions.update(list => [newAction, ...list]);
      this.toastService.info(`⚡ Rule triggered: ${this.getActionTypeLabel(event.actionType)} for ${event.studentName}`);
    });
  }

  // ==================== ANALYTICS ====================
  loadAnalytics(): void {
    this.analyticsLoading.set(true);
    this.adminApi.getOutcomeStats().subscribe({
      next: (data) => this.outcomeStats.set(data),
      error: () => this.toastService.error('Failed to load outcome stats'),
    });
    this.adminApi.getIncidentTrends().subscribe({
      next: (data) => this.incidentTrends.set(data),
      error: () => this.toastService.error('Failed to load incident trends'),
    });
    this.adminApi.getTopCategories().subscribe({
      next: (data) => {
        this.topCategories.set(data);
        this.analyticsLoading.set(false);
      },
      error: () => {
        this.analyticsLoading.set(false);
        this.toastService.error('Failed to load top categories');
      },
    });
  }

  selectDrilldown(outcome: string): void {
    // Toggle: if already selected, clear the filter
    if (this.drilldownOutcome() === outcome) {
      this.drilldownOutcome.set(null);
    } else {
      this.drilldownOutcome.set(outcome);
    }
  }

  clearDrilldown(): void {
    this.drilldownOutcome.set(null);
  }

  getBarPercent(count: number): number {
    return Math.round((count / this.maxCategoryCount()) * 100);
  }

  private listenForFlagResolved(): void {
    effect(() => {
      const event = this.socketService.lastFlagResolved();
      if (!event) return;
      // Refresh analytics when a flag is resolved
      this.loadAnalytics();
      this.loadTriggeredActions();
    });
  }
}
