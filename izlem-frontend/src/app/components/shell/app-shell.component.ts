import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, RouterModule, TranslatePipe],
  template: `
    <div class="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <!-- Desktop Sidebar -->
      <app-sidebar class="hidden md:block" />

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
        <!-- Offline Banner -->
        @if (!socketService.isOnline()) {
          <div class="bg-red-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 animate-pulse sticky top-0 z-[60]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            Offline - Reconnecting...
          </div>
        }
        <router-outlet />
      </main>

      <!-- Bottom Navigation (Mobile Only - Staff) -->
      @if (!authService.isParent()) {
      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 px-4 py-3 flex justify-around items-center z-50 shadow-2xl">
        @if (authService.canSeeTeacherHub()) {
        <a routerLink="/teacher" routerLinkActive="nav-active" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-active:scale-90 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.hubShort' | translate }}</span>
          <div class="nav-glow absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full blur-[2px] opacity-0 transition-opacity"></div>
        </a>
        }
        @if (authService.canSeeGuideHud()) {
        <a routerLink="/guide" routerLinkActive="nav-active" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-active:scale-90 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.hudShort' | translate }}</span>
          <div class="nav-glow absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full blur-[2px] opacity-0 transition-opacity"></div>
        </a>
        }
        <a routerLink="/students" routerLinkActive="nav-active" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-active:scale-90 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.directoryShort' | translate }}</span>
          <div class="nav-glow absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full blur-[2px] opacity-0 transition-opacity"></div>
        </a>
        @if (authService.canSeeChat()) {
        <a routerLink="/chat" routerLinkActive="nav-active" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-active:scale-90 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.chatShort' | translate }}</span>
          <div class="nav-glow absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full blur-[2px] opacity-0 transition-opacity"></div>
        </a>
        }
        @if (authService.canSeeAdminPanel()) {
        <a routerLink="/admin" routerLinkActive="nav-active" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-active:scale-90 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.adminShort' | translate }}</span>
          <div class="nav-glow absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full blur-[2px] opacity-0 transition-opacity"></div>
        </a>
        }
        <button (click)="authService.logout()" class="flex flex-col items-center gap-1 p-2 text-slate-500 transition-all duration-300 relative group">
          <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 border border-slate-700 group-active:scale-95 transition-transform">
            {{ authService.initials() }}
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider">{{ 'nav.exitShort' | translate }}</span>
        </button>
      </nav>
      }
    </div>
  `,
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly authService = inject(AuthService);
  readonly socketService = inject(SocketService);
}

