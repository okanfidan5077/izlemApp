import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, map } from 'rxjs';
import { LoginRequest, LoginResponse, RegisterRequest, User, UserRole, ApiResponse } from '../models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'izlem_token';
const USER_KEY = 'izlem_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  
  // Signals for reactive state
  private _token = signal<string | null>(this.getStoredToken());
  private _user = signal<User | null>(this.getStoredUser());
  private _error = signal<string | null>(null);
  
  // Public computed signals
  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly currentUser = this.user; // alias for template use
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole = computed(() => this._user()?.role ?? null);
  readonly isParent = computed(() => this._user()?.role === UserRole.PARENT);

  // Computed: user display name
  readonly displayName = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  // Computed: user initials
  readonly initials = computed(() => {
    const u = this._user();
    if (!u) return '';
    return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
  });

  // Computed: user role display label
  readonly roleLabel = computed(() => {
    const role = this._user()?.role;
    switch (role) {
      case UserRole.ADMIN: return 'Administrator';
      case UserRole.TEACHER: return 'Teacher';
      case UserRole.GUIDE_TEACHER: return 'Guide Teacher';
      case UserRole.PARENT: return 'Parent';
      default: return '';
    }
  });

  // Computed: role-based visibility for sidebar nav links
  readonly canSeeTeacherHub = computed(() => {
    const role = this._user()?.role;
    return role === UserRole.TEACHER || role === UserRole.GUIDE_TEACHER || role === UserRole.ADMIN;
  });

  readonly canSeeGuideHud = computed(() => {
    const role = this._user()?.role;
    return role === UserRole.GUIDE_TEACHER || role === UserRole.ADMIN;
  });

  readonly canSeeAdminPanel = computed(() => {
    const role = this._user()?.role;
    return role === UserRole.ADMIN;
  });

  readonly canSeeParentPortal = computed(() => {
    const role = this._user()?.role;
    return role === UserRole.PARENT;
  });

  readonly canSeeChat = computed(() => {
    const role = this._user()?.role;
    return role === UserRole.TEACHER || role === UserRole.GUIDE_TEACHER || role === UserRole.PARENT;
  });

  constructor() {
    this.validateStoredToken();
  }

  private getStoredToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }

  private getStoredUser(): User | null {
    if (typeof localStorage !== 'undefined') {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  private validateStoredToken(): void {
    const token = this._token();
    if (token) {
      console.log('🔐 Using stored auth token');
    }
  }

  // Store user after successful login
  setUserFromLogin(response: LoginResponse): void {
    this._token.set(response.accessToken);
    this._user.set(response.user);
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._error.set(null);
  }

  // Get the role-based redirect path
  private getRoleRedirectPath(role?: UserRole): string {
    switch (role) {
      case UserRole.ADMIN: return '/admin';
      case UserRole.TEACHER: return '/teacher';
      case UserRole.GUIDE_TEACHER: return '/guide';
      case UserRole.PARENT: return '/parent';
      default: return '/guide';
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/auth/login`, credentials).pipe(
      map(response => response.data),
      tap({
        next: (response) => {
          this.setUserFromLogin(response);
          // Redirect based on user status
          if (!response.user.isActive) {
            this.router.navigate(['/awaiting-approval']);
          } else {
            const path = this.getRoleRedirectPath(response.user.role);
            this.router.navigate([path]);
          }
        },
        error: (err) => {
          console.error('Login failed:', err);
          this._error.set(err.error?.message || 'Login failed');
        }
      }),
      catchError(err => {
        this._error.set(err.error?.message || 'Invalid email or password');
        throw err;
      })
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/auth/register`, data).pipe(
      map(response => response.data),
      catchError(err => {
        this._error.set(err.error?.message || 'Registration failed');
        throw err;
      })
    );
  }

  sendResetLink(email: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/auth/forgot-password`, { email }).pipe(
      map(response => response.data),
      catchError(err => {
        this._error.set(err.error?.message || 'Failed to send reset link');
        throw err;
      })
    );
  }

  logout(message?: string): void {
    this._token.set(null);
    this._user.set(null);
    this._error.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    if (message) {
      this.router.navigate(['/login'], { queryParams: { message } });
    } else {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this._token();
  }

  clearError(): void {
    this._error.set(null);
  }
}
