import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, ToastService, TranslationService } from '../../core/services';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  readonly translationService = inject(TranslationService);

  email = signal('');
  isSubmitting = signal(false);
  sent = signal(false);

  submit(): void {
    if (!this.email()) {
      this.toastService.error(this.translationService.translate('auth.enterEmail'));
      return;
    }

    this.isSubmitting.set(true);
    this.authService.clearError();

    this.authService.sendResetLink(this.email()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sent.set(true);
        this.toastService.success(this.translationService.translate('auth.resetLinkSentToast'));
      },
      error: () => {
        this.isSubmitting.set(false);
        this.sent.set(true);
        this.toastService.success(this.translationService.translate('auth.resetLinkSentToast'));
      }
    });
  }
}
