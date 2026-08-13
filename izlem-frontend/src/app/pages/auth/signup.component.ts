import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, ToastService, TranslationService } from '../../core/services';
import { UserRole, ApiResponse } from '../../core/models';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  readonly translationService = inject(TranslationService);

  fullName = signal('');
  email = signal('');
  schoolId = signal('');
  role = signal<string>('');
  password = signal('');
  studentId = signal('');
  isSubmitting = signal(false);

  // Student validation state
  studentValid = signal<boolean | null>(null);
  studentInfo = signal<string>('');
  validatingStudent = signal(false);

  readonly roles = [
    { value: 'TEACHER', key: 'roles.TEACHER' },
    { value: 'GUIDE_TEACHER', key: 'roles.GUIDE_TEACHER' },
    { value: 'ADMIN', key: 'roles.ADMIN' },
    { value: 'PARENT', key: 'roles.PARENT' },
  ];

  isParent(): boolean {
    return this.role() === 'PARENT';
  }

  onRoleChange(newRole: string): void {
    this.role.set(newRole);
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
        this.studentInfo.set(this.translationService.translate('auth.studentNotFound'));
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
      this.toastService.error(this.translationService.translate('auth.fillAllFields'));
      return;
    }

    const nameParts = this.fullName().trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    this.isSubmitting.set(true);
    this.authService.register({
      email: this.email().trim(),
      password: this.password() || 'Temp1234!',
      firstName,
      lastName,
      role: this.role() as UserRole,
      schoolId: this.schoolId().trim(),
      studentId: this.isParent() ? this.studentId().trim() : undefined
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/awaiting-approval']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.error?.message || this.translationService.translate('auth.registrationFailed'));
      }
    });
  }
}
