// API Response wrapper (matches backend GlobalResponseInterceptor)
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}

// Enums matching Prisma schema
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  GUIDE_TEACHER = 'GUIDE_TEACHER',
  PARENT = 'PARENT',
}

export enum IncidentStatus {
  DISPATCHED = 'DISPATCHED',
  RECEIVED = 'RECEIVED',
  UNACCOUNTED = 'UNACCOUNTED',
  RESOLVED = 'RESOLVED',
}

export enum CategoryGroup {
  DISCIPLINE = 'DISCIPLINE',
  PRAISE = 'PRAISE',
}

export enum ActionType {
  LOG_WARNING = 'LOG_WARNING',
  NOTIFY_PARENT = 'NOTIFY_PARENT',
  REQUIRE_ADMIN_MEETING = 'REQUIRE_ADMIN_MEETING',
  ASSIGN_DETENTION = 'ASSIGN_DETENTION',
  POSITIVE_REWARD = 'POSITIVE_REWARD',
}

export enum ActionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ResolutionOutcome {
  SUCCESSFUL = 'SUCCESSFUL',
  DISMISSED = 'DISMISSED',
  LOW_ENGAGEMENT = 'LOW_ENGAGEMENT',
  ESCALATED = 'ESCALATED',
  NO_SHOW = 'NO_SHOW',
}

// School model
export interface School {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

// User model
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  schoolId: string;
  school?: School;
  studentId?: string;
  student?: { id: string; firstName: string; lastName: string; studentNo: string };
  createdAt: Date;
  updatedAt: Date;
}

// Student model
export interface Student {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade?: string;
  section?: string;
  isActive: boolean;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Student with behavioral stats (for directory listing)
export interface StudentWithStats extends Student {
  totalPraises: number;
  totalIncidents: number;
  behaviorScore: number; // 0–100, formula: 50 + (5P - 10I)
}

// Triggered action summary (lightweight, used in profiles and history)
export interface TriggeredActionSummary {
  id: string;
  actionType: string;
  status: string;
  count: number;
  description: string;
  categoryName: string;
  threshold: number;
  incidentId: string;
  createdAt: Date;
  resolutionOutcome?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: Date | null;
  resolvedByName?: string | null;
}

// History entry for behavioral drawer
export interface HistoryEntry {
  id: string;
  type: 'PRAISE' | 'INCIDENT';
  categoryName: string;
  description: string | null;
  teacherName: string;
  dispatchedAt: string;
  triggeredAction?: TriggeredActionSummary | null;
}

// Full student profile for the behavioral intelligence drawer
export interface StudentProfile {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  section: string | null;
  totalPraises: number;
  totalIncidents: number;
  behaviorScore: number;
  positivePercent: number;
  historyFeed: HistoryEntry[];
  triggeredActions: TriggeredActionSummary[];
}

// Flagged student for Guide HUD (students with PENDING triggered actions)
export interface FlaggedStudent {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  section: string | null;
  pendingActions: TriggeredActionSummary[];
}

// Infraction Category model
export interface InfractionCategory {
  id: string;
  name: string;
  description?: string;
  group: CategoryGroup;
  points: number;
  isActive: boolean;
  schoolId: string;
  disciplineRules?: DisciplineRule[];
  createdAt: Date;
  updatedAt: Date;
}

// Discipline Rule model
export interface DisciplineRule {
  id: string;
  description: string;
  actionType: ActionType;
  threshold: number;
  isActive: boolean;
  schoolId: string;
  categoryId: string;
  category?: InfractionCategory;
  createdAt: Date;
  updatedAt: Date;
}

// Semester Config model
export interface SemesterConfig {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Triggered Action model (audit log for rule engine)
export interface TriggeredAction {
  id: string;
  actionType: ActionType;
  status: ActionStatus;
  count: number;
  createdAt: Date;
  studentId: string;
  student?: { id: string; firstName: string; lastName: string; studentNo: string };
  ruleId: string;
  rule?: DisciplineRule & { category?: InfractionCategory };
  incidentId: string;
  schoolId: string;
  resolutionOutcome?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: Date | null;
  resolvedById?: string | null;
  notifications?: Notification[];
}

// Incident model
export interface Incident {
  id: string;
  description?: string;
  status: IncidentStatus;
  visibleToParent: boolean;
  isLessonTerminated?: boolean;
  isClassTerminated?: boolean;
  dispatchedAt: Date;
  receivedAt?: Date;
  resolvedAt?: Date;
  notes?: string;
  schoolId: string;
  studentId: string;
  student?: Student;
  categoryId: string;
  category?: InfractionCategory;
  createdById: string;
  createdBy?: User;
  receivedById?: string;
  receivedBy?: User;
  triggeredActions?: TriggeredAction[];
  createdAt: Date;
  updatedAt: Date;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  role?: UserRole;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  schoolId: string;
}

// WebSocket event payloads
export interface NewIncidentEvent {
  type: 'NEW_INCIDENT';
  incidentId: string;
  studentName: string;
  categoryName: string;
  teacherName: string;
  timestamp: Date;
}

export interface IncidentReceivedEvent {
  type: 'INCIDENT_RECEIVED';
  incidentId: string;
  studentName: string;
  receivedByName: string;
  receivedAt: Date;
}

export interface IncidentAlarmEvent {
  type: 'INCIDENT_ALARM';
  severity: 'HIGH';
  incidentId: string;
  studentName: string;
  minutesOverdue: number;
}

export interface IncidentResolvedEvent {
  type: 'INCIDENT_RESOLVED';
  incidentId: string;
  studentName: string;
  resolvedByName: string;
  resolvedAt: Date;
}

export interface RuleTriggeredEvent {
  type: 'RULE_TRIGGERED';
  triggeredActionId: string;
  studentName: string;
  categoryName: string;
  actionType: ActionType;
  count: number;
  threshold: number;
  description: string;
  timestamp: Date;
}

export interface StudentFlaggedEvent {
  type: 'STUDENT_FLAGGED';
  studentId: string;
  studentName: string;
  actionType: string;
  description: string;
  categoryName: string;
  count: number;
  threshold: number;
  triggeredActionId: string;
  timestamp: Date;
}

export interface FlagResolvedEvent {
  type: 'FLAG_RESOLVED';
  triggeredActionId: string;
  studentId: string;
  resolvedByName: string;
  resolutionOutcome: string;
  timestamp: Date;
}

export interface ResolveTriggeredActionRequest {
  resolutionOutcome: ResolutionOutcome;
  resolutionNote: string;
}

// API request types
export interface CreateIncidentRequest {
  studentId: string;
  categoryId: string;
  description?: string;
  notes?: string;
  isLessonTerminated?: boolean;
  isClassTerminated?: boolean;
}

// Backend Response Types
export interface StudentProfileResponse {
  student: Pick<Student, 'id' | 'firstName' | 'lastName' | 'studentNo' | 'grade' | 'section'>;
  semesterName: string;
  totalIncidents: number;
  totalPraises: number;
  behaviorScore: number;
  positivePercent: number;
  triggeredActions: TriggeredActionSummary[];
}

export interface DashboardStats {
  activeStudents: number;
  pendingApprovals: number;
  criticalIncidents: number;
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export interface Notification {
  id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt: Date;
  error?: string;
}

// Analytics response types
export interface OutcomeStatsItem {
  outcome: string;
  count: number;
}

export interface IncidentTrendItem {
  date: string;
  count: number;
}

export interface TopCategoryItem {
  categoryId: string;
  categoryName: string;
  count: number;
}

// ==================== CHAT ====================

export interface ChatConversation {
  id: string;
  teacherId: string;
  parentId: string;
  schoolId: string;
  teacher: ChatPartner;
  parent: ChatPartner;
  messages: ChatMessage[]; // last message preview
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  isRead: boolean;
  senderId: string;
  sender: ChatPartner;
  conversationId: string;
  createdAt: Date;
}

export interface ChatPartner {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: UserRole;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NewChatMessageEvent {
  type: 'NEW_MESSAGE';
  message: ChatMessage;
  conversationId: string;
  sender: { id: string; firstName: string; lastName: string };
}

export interface MessagesReadEvent {
  type: 'MESSAGES_READ';
  conversationId: string;
  readByUserId: string;
}

