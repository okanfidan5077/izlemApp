import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import {
  Student,
  StudentWithStats,
  StudentProfile,
  FlaggedStudent,
  ApiResponse,
  ResolveTriggeredActionRequest,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // State signals
  private _students = signal<StudentWithStats[]>([]);
  private _selectedStudent = signal<Student | null>(null);
  private _flaggedStudents = signal<FlaggedStudent[]>([]);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly students = this._students.asReadonly();
  readonly selectedStudent = this._selectedStudent.asReadonly();
  readonly flaggedStudents = this._flaggedStudents.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Load all students with behavioral stats */
  getStudents(): Observable<StudentWithStats[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<ApiResponse<StudentWithStats[]>>(`${this.apiUrl}/students`).pipe(
      map(response => response.data),
      tap({
        next: (students) => {
          this._students.set(students);
          this._loading.set(false);
        },
        error: () => {
          this._error.set('Failed to load students');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to load students');
        return of([]);
      })
    );
  }

  /** Get full behavioral profile for the drawer */
  getStudentProfile(id: string): Observable<StudentProfile> {
    return this.http.get<ApiResponse<StudentProfile>>(`${this.apiUrl}/students/${id}/profile`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Failed to load student profile:', err);
        throw err;
      })
    );
  }

  /** Search students by query */
  searchStudents(query: string): Observable<Student[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    return this.http.get<ApiResponse<Student[]>>(`${this.apiUrl}/students/search?q=${encodeURIComponent(query)}`).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Student search failed:', err);
        return of([]);
      })
    );
  }

  /** Get single student by ID */
  getStudent(id: string): Observable<Student> {
    return this.http.get<ApiResponse<Student>>(`${this.apiUrl}/students/${id}`).pipe(
      map(response => response.data),
      tap(student => this._selectedStudent.set(student)),
      catchError(err => {
        console.error('Failed to load student:', err);
        throw err;
      })
    );
  }

  getCachedStudents(): StudentWithStats[] {
    return this._students();
  }

  setSelectedStudent(student: Student | null): void {
    this._selectedStudent.set(student);
  }

  clearError(): void {
    this._error.set(null);
  }

  /** Get flagged students (PENDING triggered actions) */
  getFlaggedStudents(): Observable<FlaggedStudent[]> {
    return this.http.get<ApiResponse<FlaggedStudent[]>>(`${this.apiUrl}/students/flagged`).pipe(
      map(response => response.data),
      tap(flagged => this._flaggedStudents.set(flagged)),
      catchError(err => {
        console.error('Failed to load flagged students:', err);
        return of([]);
      })
    );
  }

  /** Resolve a triggered action */
  resolveTriggeredAction(actionId: string, request: ResolveTriggeredActionRequest): Observable<any> {
    return this.http.patch<ApiResponse<any>>(
      `${this.apiUrl}/students/triggered-actions/${actionId}/resolve`,
      request
    ).pipe(
      map(response => response.data),
      catchError(err => {
        console.error('Failed to resolve triggered action:', err);
        throw err;
      })
    );
  }

  /** Remove a flagged student from the local signal state */
  removeFlaggedStudent(studentId: string): void {
    this._flaggedStudents.update(list =>
      list.filter(s => s.id !== studentId)
    );
  }

  /** Remove a specific triggered action from a flagged student */
  removeFlaggedAction(triggeredActionId: string): void {
    this._flaggedStudents.update(list => {
      return list
        .map(s => ({
          ...s,
          pendingActions: s.pendingActions.filter(a => a.id !== triggeredActionId),
        }))
        .filter(s => s.pendingActions.length > 0);
    });
  }
}
