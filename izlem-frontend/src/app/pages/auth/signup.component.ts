import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, ToastService } from '../../core/services';
import { UserRole, ApiResponse } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  fullName = signal('');
  email = signal('');
  schoolId = signal('');
  role = signal<string>('');
  password = signal('');
  studentId = signal('');
  isSubmitting = signal(false);

  // Student validation state
  studentValid = signal<boolean | null>(null); // null = not checked, true = valid, false = invalid
  studentInfo = signal<string>('');
  validatingStudent = signal(false);

  readonly roles = [
    { value: 'TEACHER', label: 'Teacher' },
    { value: 'GUIDE_TEACHER', label: 'Guide Teacher' },
    { value: 'ADMIN', label: 'Administrator' },
    { value: 'PARENT', label: 'Parent / Guardian' },
  ];

  isParent(): boolean {
    return this.role() === 'PARENT';
  }

  onRoleChange(newRole: string): void {
    this.role.set(newRole);
    // Reset student validation when role changes
    if (newRole !== 'PARENT') {
      this.studentId.set('');
      this.studentValid.set(null);
      this.studentInfo.set('');
    }
  }

  validateStudentId(): void {
    const sid = this.studentId().trim();
    const school = this.schoolId().trim();

    if (!sid || !school) {
      this.studentValid.set(null);
      this.studentInfo.set('');
      return;
    }

    this.validatingStudent.set(true);
    this.http.get<ApiResponse<any>>(
      `${environment.apiUrl}/auth/validate-student/${school}/${sid}`
    ).subscribe({
      next: (res) => {
        this.validatingStudent.set(false);
        this.studentValid.set(true);
        const s = res.data;
        this.studentInfo.set(`${s.firstName} ${s.lastName} (${s.studentNo})`);
      },
      error: () => {
        this.validatingStudent.set(false);
        this.studentValid.set(false);
        this.studentInfo.set('Student not found. Please check the ID.');
      }
    });
  }

  canSubmit(): boolean {
    if (!this.fullName() || !this.email() || !this.schoolId() || !this.role()) return false;
    if (this.isParent() && this.studentValid() !== true) return false;
    if (this.isSubmitting()) return false;
    return true;
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    const nameParts = this.fullName().trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    this.isSubmitting.set(true);
    this.authService.clearError();

    const payload: any = {
      email: this.email(),
      password: 'temp12345678', // Temporary password, admin will set real one
      firstName,
      lastName,
      schoolId: this.schoolId(),
      role: this.role() as UserRole,
    };

    if (this.isParent()) {
      payload.studentId = this.studentId().trim();
    }

    this.authService.register(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toastService.success('Access request submitted! An administrator will review your enrollment.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.error?.message || 'Registration failed');
      }
    });
  }
}
