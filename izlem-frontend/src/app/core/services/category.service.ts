import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { InfractionCategory, CategoryGroup, DisciplineRule, ApiResponse, ActionType } from '../models';
import { environment } from '../../../environments/environment';

export interface CreateCategoryRequest {
  name: string;
  group: CategoryGroup;
  points: number;
}

export interface CreateRuleRequest {
  categoryId: string;
  threshold: number;
  description: string;
  actionType: ActionType;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // State signals
  private _categories = signal<InfractionCategory[]>([]);
  private _rules = signal<DisciplineRule[]>([]);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly rules = this._rules.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed: discipline categories only
  readonly disciplineCategories = computed(() =>
    this._categories().filter(c => c.group === CategoryGroup.DISCIPLINE)
  );

  // Computed: praise categories only
  readonly praiseCategories = computed(() =>
    this._categories().filter(c => c.group === CategoryGroup.PRAISE)
  );

  // Load all categories from API
  getCategories(forceRefresh = false): Observable<InfractionCategory[]> {
    if (!forceRefresh && this._categories().length > 0) {
      return of(this._categories());
    }

    this._loading.set(true);
    this._error.set(null);
    
    return this.http.get<ApiResponse<InfractionCategory[]>>(`${this.apiUrl}/configuration/categories`).pipe(
      map(response => response.data),
      tap({
        next: (categories) => {
          console.log('📋 Loaded categories:', categories.length);
          this._categories.set(categories);
          this._loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load categories:', err);
          this._error.set('Failed to load categories');
          this._loading.set(false);
        }
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to load categories');
        return of([]);
      })
    );
  }

  // Load categories by group
  getCategoriesByGroup(group: CategoryGroup): Observable<InfractionCategory[]> {
    return this.http.get<ApiResponse<InfractionCategory[]>>(
      `${this.apiUrl}/configuration/categories?group=${group}`
    ).pipe(map(response => response.data));
  }

  // Create a new category
  createCategory(data: CreateCategoryRequest): Observable<InfractionCategory> {
    this._loading.set(true);
    
    return this.http.post<ApiResponse<InfractionCategory>>(`${this.apiUrl}/configuration/categories`, data).pipe(
      map(response => response.data),
      tap({
        next: (category) => {
          console.log('✅ Category created:', category.name);
          // Add to local list
          this._categories.update(cats => [...cats, category]);
          this._loading.set(false);
        },
        error: () => this._loading.set(false)
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to create category');
        throw err;
      })
    );
  }

  // Update category (toggle active state)
  updateCategory(id: string, data: Partial<InfractionCategory>): Observable<InfractionCategory> {
    this._loading.set(true);
    
    return this.http.patch<ApiResponse<InfractionCategory>>(`${this.apiUrl}/configuration/categories/${id}`, data).pipe(
      map(response => response.data),
      tap({
        next: (updatedCategory) => {
          console.log('✅ Category updated:', updatedCategory.name);
          // Update in local list
          this._categories.update(cats => 
            cats.map(c => c.id === id ? updatedCategory : c)
          );
          this._loading.set(false);
        },
        error: () => this._loading.set(false)
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to update category');
        throw err;
      })
    );
  }

  // Toggle category active state
  toggleCategoryActive(id: string, isActive: boolean): Observable<InfractionCategory> {
    return this.updateCategory(id, { isActive });
  }

  // Load rules for a category
  getRulesForCategory(categoryId: string): Observable<DisciplineRule[]> {
    this._loading.set(true);
    
    return this.http.get<ApiResponse<DisciplineRule[]>>(
      `${this.apiUrl}/configuration/rules?categoryId=${categoryId}`
    ).pipe(
      map(response => response.data),
      tap({
        next: (rules) => {
          console.log('📜 Loaded rules for category:', rules.length);
          this._rules.set(rules);
          this._loading.set(false);
        },
        error: () => this._loading.set(false)
      }),
      catchError(err => {
        this._loading.set(false);
        return of([]);
      })
    );
  }

  // Get all rules
  getAllRules(forceRefresh = false): Observable<DisciplineRule[]> {
    if (!forceRefresh && this._rules().length > 0) {
      return of(this._rules());
    }
    return this.http.get<ApiResponse<DisciplineRule[]>>(`${this.apiUrl}/configuration/rules`).pipe(
      map(response => response.data),
      tap(rules => this._rules.set(rules))
    );
  }

  // Create a new rule
  createRule(data: CreateRuleRequest): Observable<DisciplineRule> {
    this._loading.set(true);
    
    return this.http.post<ApiResponse<DisciplineRule>>(`${this.apiUrl}/configuration/rules`, data).pipe(
      map(response => response.data),
      tap({
        next: (rule) => {
          console.log('✅ Rule created:', rule.description);
          // Add to local list
          this._rules.update(rules => [...rules, rule]);
          this._loading.set(false);
        },
        error: () => this._loading.set(false)
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set(err.error?.message || 'Failed to create rule');
        throw err;
      })
    );
  }

  // Get discipline categories (sync from cache)
  getDisciplineCategories(): InfractionCategory[] {
    return this._categories().filter(c => c.group === CategoryGroup.DISCIPLINE);
  }

  // Get praise categories (sync from cache)  
  getPraiseCategories(): InfractionCategory[] {
    return this._categories().filter(c => c.group === CategoryGroup.PRAISE);
  }

  // Get cached categories
  getCachedCategories(): InfractionCategory[] {
    return this._categories();
  }

  // Clear error
  clearError(): void {
    this._error.set(null);
  }

  // Refresh categories (alias for getCategories)
  refresh(): void {
    this.getCategories(true).subscribe();
    this.getAllRules(true).subscribe();
  }

  // Toggle category helper
  toggleCategory(id: string): Observable<InfractionCategory> {
    const cat = this._categories().find(c => c.id === id);
    if (!cat) return of({} as InfractionCategory); // Should not happen
    return this.toggleCategoryActive(id, !cat.isActive);
  }

  // Delete rule
  deleteRule(ruleId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/configuration/rules/${ruleId}`).pipe(
      map(res => res.data),
      tap(() => {
        // Remove from local list
        this._rules.update(rules => rules.filter(r => r.id !== ruleId));
      })
    );
  }
}
