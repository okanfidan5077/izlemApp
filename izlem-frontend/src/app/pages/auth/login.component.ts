import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, ToastService } from '../../core/services';

import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  readonly translationService = inject(TranslationService);

  email = signal('');
  password = signal('');
  isSubmitting = signal<boolean>(false);
  showPassword = signal<boolean>(false);

  readonly error = this.authService.error;

  ngOnInit(): void {
    // Check for message from logout/interceptor
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      // Small delay to ensure toast service is ready and not overlapping with other UI events
      setTimeout(() => this.toastService.info(message), 100);
    }
  }

  login(): void {
    if (!this.email() || !this.password()) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    this.isSubmitting.set(true);
    this.authService.clearError();

    this.authService.login({
      email: this.email(),
      password: this.password()
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toastService.success('Welcome back!');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.error?.message || 'Invalid email or password');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}
