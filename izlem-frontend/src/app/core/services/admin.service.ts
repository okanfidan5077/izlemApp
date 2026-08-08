import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, User, TriggeredAction, SemesterConfig, DashboardStats, OutcomeStatsItem, IncidentTrendItem, TopCategoryItem } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getStats(): Observable<DashboardStats> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.apiUrl}/admin/stats`).pipe(
      map(res => res.data)
    );
  }

  getUsers(search?: string, status?: string): Observable<User[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);

    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/admin/users`, { params }).pipe(
      map(res => res.data)
    );
  }

  setUserStatus(userId: string, isActive: boolean): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.apiUrl}/admin/users/${userId}/status`, { isActive }).pipe(
      map(res => res.data)
    );
  }

  resetUserPassword(userId: string, password: string): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.apiUrl}/admin/users/${userId}/reset-password`, { password }).pipe(
      map(res => res.data)
    );
  }

  deleteUser(userId: string): Observable<{ message: string }> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.apiUrl}/admin/users/${userId}`).pipe(
      map(res => res.data)
    );
  }

  // === Logic Engine ===

  getTriggeredActions(): Observable<TriggeredAction[]> {
    return this.http.get<ApiResponse<TriggeredAction[]>>(`${this.apiUrl}/admin/triggered-actions`).pipe(
      map(res => res.data)
    );
  }

  cancelTriggeredAction(id: string): Observable<void> {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/admin/triggered-actions/${id}/cancel`, {}).pipe(
      map(res => res.data)
    );
  }

  getCurrentSemester(): Observable<SemesterConfig | null> {
    return this.http.get<ApiResponse<SemesterConfig | null>>(`${this.apiUrl}/admin/semester`).pipe(
      map(res => res.data)
    );
  }

  saveSemester(data: { name: string; startDate: string; endDate: string }): Observable<SemesterConfig> {
    return this.http.post<ApiResponse<SemesterConfig>>(`${this.apiUrl}/admin/semester`, data).pipe(
      map(res => res.data)
    );
  }

  // === Analytics ===

  getOutcomeStats(): Observable<OutcomeStatsItem[]> {
    return this.http.get<ApiResponse<OutcomeStatsItem[]>>(`${this.apiUrl}/admin/analytics/outcome-stats`).pipe(
      map(res => res.data)
    );
  }

  getIncidentTrends(): Observable<IncidentTrendItem[]> {
    return this.http.get<ApiResponse<IncidentTrendItem[]>>(`${this.apiUrl}/admin/analytics/incident-trends`).pipe(
      map(res => res.data)
    );
  }

  getTopCategories(): Observable<TopCategoryItem[]> {
    return this.http.get<ApiResponse<TopCategoryItem[]>>(`${this.apiUrl}/admin/analytics/top-categories`).pipe(
      map(res => res.data)
    );
  }
}
