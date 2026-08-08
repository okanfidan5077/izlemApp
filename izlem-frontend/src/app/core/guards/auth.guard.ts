import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { UserRole } from '../models';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  // Check authentication
  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  // Check if user is active (approved by admin)
  const user = authService.currentUser();
  if (user && !user.isActive) {
    router.navigate(['/awaiting-approval']);
    return false;
  }

  // Check role-based access
  const allowedRoles = route.data?.['allowedRoles'] as UserRole[] | undefined;
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = authService.userRole();
    if (userRole && !allowedRoles.includes(userRole)) {
      toastService.error('Access Denied — You don\'t have permission to view this page.');
      // Redirect to user's home hub
      const homePath = getHomeHub(userRole);
      router.navigate([homePath]);
      return false;
    }
  }

  return true;
};

function getHomeHub(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN: return '/admin';
    case UserRole.GUIDE_TEACHER: return '/guide';
    case UserRole.TEACHER: return '/teacher';
    case UserRole.PARENT: return '/parent';
    default: return '/teacher';
  }
}
