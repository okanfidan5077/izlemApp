import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Incident, Student, StudentProfileResponse, ApiResponse } from '../models';

export type StudentSummary = Pick<Student, 'id' | 'firstName' | 'lastName' | 'studentNo' | 'grade' | 'section'>;

@Injectable({
  providedIn: 'root'
})
export class ParentApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getLinkedStudents(): Observable<StudentSummary[]> {
    return this.http.get<ApiResponse<StudentSummary[]>>(`${this.apiUrl}/parent/students`).pipe(
      map(response => response.data)
    );
  }

  getStudentProfile(studentId?: string): Observable<StudentProfileResponse> {
    let params = new HttpParams();
    if (studentId) {
      params = params.set('studentId', studentId);
    }
    return this.http.get<ApiResponse<StudentProfileResponse>>(`${this.apiUrl}/parent/student-profile`, { params }).pipe(
      map(response => response.data)
    );
  }

  getIncidentHistory(studentId?: string): Observable<Incident[]> {
    let params = new HttpParams();
    if (studentId) {
      params = params.set('studentId', studentId);
    }
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/parent/incident-history`, { params }).pipe(
      map(response => response.data)
    );
  }

  getRules(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/configuration/rules`).pipe(
      map(response => response.data)
    );
  }
}
