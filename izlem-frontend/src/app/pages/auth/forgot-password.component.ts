import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, ToastService } from '../../core/services';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  email = signal('');
  isSubmitting = signal(false);
  sent = signal(false);

  submit(): void {
    if (!this.email()) {
      this.toastService.error('Please enter your email address');
      return;
    }

    this.isSubmitting.set(true);
    this.authService.clearError();

    this.authService.sendResetLink(this.email()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sent.set(true);
        this.toastService.success('If an account exists, a reset link has been sent.');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        // Still show success to prevent email enumeration
        this.sent.set(true);
        this.toastService.success('If an account exists, a reset link has been sent.');
      }
    });
  }
}
