import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import {
  Incident,
  CreateIncidentRequest,
  IncidentStatus,
  ApiResponse
} from '../models';
import { SocketService } from './socket.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private readonly http = inject(HttpClient);
  private readonly socketService = inject(SocketService);
  private readonly apiUrl = environment.apiUrl;

  // Loading state
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Fetch all incidents and sync with SocketService
  getIncidents(): Observable<Incident[]> {
    this._loading.set(true);
    this._error.set(null);
    
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/incidents?today=true`).pipe(
      map(response => response.data),
      tap({
        next: (incidents) => {
          console.log('📋 Loaded incidents:', incidents.length);
          this.socketService.setIncidents(incidents);
          this._loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load incidents:', err);
          this._error.set('Failed to load incidents');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to load incidents');
        return of([]);
      })
    );
  }

  // Fetch incidents by status
  getIncidentsByStatus(status: IncidentStatus): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/incidents?status=${status}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Failed to load incidents by status:', err);
        return of([]);
      })
    );
  }

  // Get incidents for a specific student (for parent portal timeline)
  getStudentIncidents(studentId: string): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/incidents?studentId=${studentId}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Failed to load student incidents:', err);
        return of([]);
      })
    );
  }

  // Create new incident
  createIncident(data: CreateIncidentRequest): Observable<Incident> {
    this._loading.set(true);
    this._error.set(null);
    
    return this.http.post<ApiResponse<Incident>>(`${this.apiUrl}/incidents`, data).pipe(
      map(response => response.data),
      tap({
        next: (incident) => {
          console.log('✅ Incident created:', incident.id);
          // Add to live list - WebSocket will also push this
          this.socketService.addIncident(incident);
          this._loading.set(false);
        },
        error: (err) => {
          console.error('Failed to create incident:', err);
          this._error.set('Failed to create incident');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to create incident');
        throw err;
      })
    );
  }

  // Mark incident as received (the handshake)
  receiveIncident(id: string): Observable<Incident> {
    this._loading.set(true);
    this._error.set(null);
    
    return this.http.patch<ApiResponse<Incident>>(`${this.apiUrl}/incidents/${id}/receive`, {}).pipe(
      map(response => response.data),
      tap({
        next: (incident) => {
          console.log('✅ Incident received:', id);
          this.socketService.updateIncidentStatus(id, IncidentStatus.RECEIVED);
          this._loading.set(false);
        },
        error: (err) => {
          console.error('Failed to receive incident:', err);
          this._error.set('Failed to confirm arrival');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to confirm arrival');
        throw err;
      })
    );
  }

  // Get single incident
  getIncident(id: string): Observable<Incident> {
    return this.http.get<ApiResponse<Incident>>(`${this.apiUrl}/incidents/${id}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Failed to load incident:', err);
        throw err;
      })
    );
  }

  // Refresh incidents from API (called after WebSocket events)
  refreshIncidents(): void {
    this.getIncidents().subscribe();
  }

  // Mark incident as resolved (manual alarm clearance)
  resolveIncident(id: string): Observable<Incident> {
    this._loading.set(true);
    this._error.set(null);
    
    return this.http.patch<ApiResponse<Incident>>(`${this.apiUrl}/incidents/${id}/resolve`, {}).pipe(
      map(response => response.data),
      tap({
        next: (incident) => {
          console.log('✅ Incident resolved:', id);
          this._loading.set(false);
        },
        error: (err) => {
          console.error('Failed to resolve incident:', err);
          this._error.set('Failed to resolve incident');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to resolve incident');
        throw err;
      })
    );
  }

  // Clear error
  clearError(): void {
    this._error.set(null);
  }
}
