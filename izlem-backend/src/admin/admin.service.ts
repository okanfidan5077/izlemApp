import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  IncidentStatus,
  ActionStatus,
  Prisma,
  User,
  TriggeredAction,
  SemesterConfig,
} from '@prisma/client';
import {
  DashboardStats,
  OutcomeStatsItem,
  IncidentTrendItem,
  TopCategoryItem,
} from './interfaces/dashboard-stats.interface';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard stats for a school
   */
  async getStats(schoolId: string): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeStudents, pendingApprovals, criticalIncidents] =
      await Promise.all([
        this.prisma.student.count({
          where: { schoolId, isActive: true },
        }),
        this.prisma.user.count({
          where: { schoolId, isActive: false },
        }),
        (this.prisma.incident as any).count({
          where: {
            schoolId,
            deletedAt: null,
            status: {
              in: [IncidentStatus.DISPATCHED, IncidentStatus.RECEIVED],
            },
            dispatchedAt: { gte: today },
          },
        }),
      ]);

    return { activeStudents, pendingApprovals, criticalIncidents };
  }

  /**
   * Get all users for a school, with optional filters
   */
  async getUsers(
    schoolId: string,
    search?: string,
    status?: 'active' | 'pending',
  ): Promise<Partial<User>[]> {
    const where: Prisma.UserWhereInput = { schoolId };

    if (status === 'active') where.isActive = true;
    if (status === 'pending') where.isActive = false;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNo: true,
            grade: true,
            section: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Promise<Partial<User>[]>;
  }

  async setUserStatus(
    schoolId: string,
    userId: string,
    isActive: boolean,
  ): Promise<Partial<User>> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  async resetUserPassword(
    schoolId: string,
    userId: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) throw new NotFoundException('User not found');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }

  async deleteUser(
    schoolId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }

  async getTriggeredActions(schoolId: string): Promise<TriggeredAction[]> {
    return (this.prisma.triggeredAction as any).findMany({
      where: { schoolId, deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNo: true,
          },
        },
        rule: {
          include: {
            category: { select: { id: true, name: true, group: true } },
          },
        },
        notifications: {
          select: { id: true, status: true, sentAt: true, error: true, channel: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async cancelTriggeredAction(
    schoolId: string,
    actionId: string,
  ): Promise<TriggeredAction> {
    const action = await this.prisma.triggeredAction.findFirst({
      where: { id: actionId, schoolId },
    });
    if (!action) throw new NotFoundException('Action not found');

    return this.prisma.triggeredAction.update({
      where: { id: actionId },
      data: { status: ActionStatus.CANCELLED },
    });
  }

  async getCurrentSemester(schoolId: string): Promise<SemesterConfig | null> {
    return this.prisma.semesterConfig.findFirst({
      where: { schoolId, isCurrent: true },
    });
  }

  async upsertSemester(
    schoolId: string,
    data: { name: string; startDate: Date; endDate: Date },
  ): Promise<SemesterConfig> {
    // Deactivate all existing semesters for this school
    await this.prisma.semesterConfig.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create new active semester
    return this.prisma.semesterConfig.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: true,
        schoolId,
      },
    });
  }

  // ==================== ANALYTICS ====================

  /**
   * Get resolution outcome distribution for resolved TriggeredActions
   * within the current semester.
   */
  async getOutcomeStats(schoolId: string): Promise<OutcomeStatsItem[]> {
    const semester = await this.getCurrentSemester(schoolId);
    if (!semester) return [];

    const results = await (this.prisma.triggeredAction as any).groupBy({
      by: ['resolutionOutcome'],
      where: {
        schoolId,
        deletedAt: null,
        status: ActionStatus.COMPLETED,
        resolvedAt: {
          gte: semester.startDate,
          lte: semester.endDate,
        },
        resolutionOutcome: { not: null },
      },
      _count: { id: true },
    });

    return results.map((r: any) => ({
      outcome: r.resolutionOutcome as string,
      count: r._count?.id || 0,
    }));
  }

  /**
   * Get incident counts grouped by day within the current semester
   * to feed a trend line chart.
   */
  async getIncidentTrends(schoolId: string): Promise<IncidentTrendItem[]> {
    const semester = await this.getCurrentSemester(schoolId);
    if (!semester) return [];

    const rows = await this.prisma.$queryRaw<
      { date: Date; count: bigint }[]
    >`
      SELECT DATE_TRUNC('day', "dispatchedAt") AS date,
             COUNT(*)::bigint AS count
      FROM incidents
      WHERE "schoolId" = ${schoolId}
        AND "deletedAt" IS NULL
        AND "dispatchedAt" >= ${semester.startDate}
        AND "dispatchedAt" <= ${semester.endDate}
      GROUP BY DATE_TRUNC('day', "dispatchedAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      count: Number(r.count),
    }));
  }

  /**
   * Get top infraction categories ranked by the number of
   * TriggeredActions they generated within the current semester.
   */
  async getTopCategories(schoolId: string): Promise<TopCategoryItem[]> {
    const semester = await this.getCurrentSemester(schoolId);
    if (!semester) return [];

    const actions = await (this.prisma.triggeredAction as any).findMany({
      where: {
        schoolId,
        deletedAt: null,
        createdAt: {
          gte: semester.startDate,
          lte: semester.endDate,
        },
      },
      include: {
        rule: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Group by category
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; count: number }>();
    for (const action of actions) {
      const catId = action.rule.category.id;
      const catName = action.rule.category.name;
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(catId, { categoryId: catId, categoryName: catName, count: 1 });
      }
    }

    return Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
