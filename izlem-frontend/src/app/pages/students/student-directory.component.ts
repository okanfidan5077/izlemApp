import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StudentService } from '../../core/services/student.service';
import { AuthService } from '../../core/services/auth.service';
import { StudentWithStats, StudentProfile } from '../../core/models';
import { BehavioralDrawerComponent } from './behavioral-drawer.component';

import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-student-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BehavioralDrawerComponent, TranslatePipe],
  templateUrl: './student-directory.component.html',
  styleUrl: './student-directory.component.scss',
})
export class StudentDirectoryComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  readonly authService = inject(AuthService);

  // Expose Math for template
  readonly Math = Math;

  // ── State ──────────────────────────────────────────────────────────────────
  readonly loading = this.studentService.loading;
  readonly allStudents = this.studentService.students;

  searchQuery = signal('');
  selectedGrade = signal('');
  currentPage = signal(1);
  readonly pageSize = 20;

  // Drawer state
  drawerOpen = signal(false);
  drawerLoading = signal(false);
  selectedProfile = signal<StudentProfile | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly grades = computed(() => {
    const all = this.allStudents();
    const set = new Set(all.map(s => s.grade).filter(Boolean) as string[]);
    return Array.from(set).sort();
  });

  readonly filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const grade = this.selectedGrade();
    return this.allStudents().filter(s => {
      const matchesSearch = !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.studentNo.toLowerCase().includes(q);
      const matchesGrade = !grade || s.grade === grade;
      return matchesSearch && matchesGrade;
    });
  });

  readonly paginatedStudents = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * this.pageSize;
    return this.filteredStudents().slice(start, start + this.pageSize);
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredStudents().length / this.pageSize))
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | '...')[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.studentService.getStudents().subscribe();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onGradeChange(value: string): void {
    this.selectedGrade.set(value);
    this.currentPage.set(1);
  }

  goToPage(page: number | '...'): void {
    if (typeof page === 'number') this.currentPage.set(page);
  }

  openDrawer(student: StudentWithStats): void {
    this.drawerOpen.set(true);
    this.drawerLoading.set(true);
    this.selectedProfile.set(null);

    this.studentService.getStudentProfile(student.id).subscribe({
      next: (profile) => {
        this.selectedProfile.set(profile);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      }
    });
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedProfile.set(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getInitials(student: StudentWithStats): string {
    return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  }

  getAvatarColor(student: StudentWithStats): string {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
      'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'
    ];
    const idx = (student.firstName.charCodeAt(0) + student.lastName.charCodeAt(0)) % colors.length;
    return colors[idx];
  }

  getScoreColor(score: number): string {
    if (score >= 70) return '#10b981'; // green
    if (score >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  getScoreLabel(score: number): string {
    if (score >= 70) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 30) return 'Fair';
    return 'At Risk';
  }
}
