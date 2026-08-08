export interface DashboardStats {
  activeStudents: number;
  pendingApprovals: number;
  criticalIncidents: number;
}

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
