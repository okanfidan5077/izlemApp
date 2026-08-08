import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services';

@Component({
  selector: 'app-awaiting-approval',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <!-- Logo -->
      <div class="flex items-center gap-3 mb-8">
        <div class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">İzlem</h1>
      </div>

      <!-- Card -->
      <div class="w-full max-w-md bg-[#1e293b]/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
        <!-- Icon -->
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
          <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 class="text-xl font-bold text-white mb-3">Approval Pending</h2>
        <p class="text-slate-400 text-sm leading-relaxed mb-6">
          Your account is currently pending administrator approval. You will be notified once you can access the portal.
        </p>

        <!-- Divider -->
        <div class="border-t border-slate-700/50 my-6"></div>

        <p class="text-slate-500 text-xs mb-4">
          If you believe this is an error, please contact your school administrator.
        </p>

        <button (click)="logout()"
          class="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Sign In
        </button>
      </div>
    </div>
  `
})
export class AwaitingApprovalComponent {
  private readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
