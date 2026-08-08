import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { UserRole } from './core/models';
import { AppShellComponent } from './components/shell/app-shell.component';

export const routes: Routes = [
  // ── Auth pages — no shell/sidebar ──────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/auth/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'awaiting-approval',
    loadComponent: () => import('./pages/auth/awaiting-approval.component').then(m => m.AwaitingApprovalComponent)
  },

  // ── Protected pages — wrapped in AppShell (sidebar + router-outlet) ────
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'teacher',
        pathMatch: 'full'
      },
      {
        path: 'teacher',
        loadComponent: () => import('./pages/teacher/teacher-hub.component').then(m => m.TeacherHubComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN] }
      },
      {
        path: 'guide',
        loadComponent: () => import('./pages/guide/guide-hud.component').then(m => m.GuideHudComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.GUIDE_TEACHER, UserRole.ADMIN] }
      },
      {
        path: 'admin',
        loadComponent: () => import('./pages/admin/admin-panel.component').then(m => m.AdminPanelComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.ADMIN] }
      },
      {
        path: 'parent',
        loadComponent: () => import('./pages/parent/parent-portal.component').then(m => m.ParentPortalComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.PARENT, UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN] }
      },
      {
        path: 'students',
        loadComponent: () => import('./pages/students/student-directory.component').then(m => m.StudentDirectoryComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN, UserRole.PARENT] }
      },
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent),
        canActivate: [authGuard],
        data: { allowedRoles: [UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.PARENT] }
      },
    ]
  },

  // ── Fallback ────────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '/login'
  }
];
