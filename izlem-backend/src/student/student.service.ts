import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateStudentDto, UpdateStudentDto, ResolveTriggeredActionDto } from './dto';
import { Prisma, Student, UserRole, ActionStatus } from '@prisma/client';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface StudentWithStats {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  section: string | null;
  isActive: boolean;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
  totalPraises: number;
  totalIncidents: number;
  behaviorScore: number;
}

export interface TriggeredActionSummary {
  id: string;
  actionType: string;
  status: string;
  count: number;
  description: string;
  categoryName: string;
  threshold: number;
  incidentId: string;
  createdAt: Date;
  resolutionOutcome?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: Date | null;
  resolvedByName?: string | null;
}

export interface HistoryEntry {
  id: string;
  type: 'PRAISE' | 'INCIDENT';
  categoryName: string;
  description: string | null;
  teacherName: string;
  dispatchedAt: Date;
  triggeredAction?: TriggeredActionSummary | null;
}

export interface StudentProfile {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  section: string | null;
  totalPraises: number;
  totalIncidents: number;
  behaviorScore: number;
  positivePercent: number;
  historyFeed: HistoryEntry[];
  triggeredActions: TriggeredActionSummary[];
}

export interface FlaggedStudent {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  section: string | null;
  pendingActions: TriggeredActionSummary[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

type StudentWithIncidents = Prisma.StudentGetPayload<{
  include: {
    incidents: {
      include: {
        category: true;
      };
    };
  };
}>;

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateStudentDto): Promise<Student> {
    const tenantDb = this.prisma.forTenant(schoolId);

    try {
      return await tenantDb.student.create({
        data: {
          ...dto,
          schoolId,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Student with number ${dto.studentNo} already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Returns all students with behavioral stats for the current semester.
   * If userRole === PARENT, only returns students linked to that parent.
   */
  async findAllWithStats(
    schoolId: string,
    userId?: string,
    userRole?: string,
  ): Promise<StudentWithStats[]> {
    // 1. Find the current semester
    const semester = await this.prisma.semesterConfig.findFirst({
      where: { schoolId, isCurrent: true },
    });

    const semesterFilter = semester
      ? { dispatchedAt: { gte: semester.startDate, lte: semester.endDate } }
      : {};

    // 2. Build student filter (parent privacy)
    const studentWhere: Prisma.StudentWhereInput = { schoolId };
    if (userRole === UserRole.PARENT && userId) {
      studentWhere.parentUsers = { some: { id: userId } };
    }

    // 3. Fetch students with incident counts
    const students = await (this.prisma.student as any).findMany({
      where: studentWhere,
      include: {
        incidents: {
          where: { schoolId, deletedAt: null, ...semesterFilter },
          select: {
            id: true,
            category: { select: { group: true } },
          },
        },
      },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { lastName: 'asc' }],
    });

    // 4. Compute scores
    return students.map((student: any) => {
      const praises = student.incidents.filter(
        (i: any) => i.category.group === 'PRAISE',
      ).length;
      const incidents = student.incidents.filter(
        (i: any) => i.category.group === 'DISCIPLINE',
      ).length;
      const rawScore = 50 + 5 * praises - 10 * incidents;
      const behaviorScore = Math.max(0, Math.min(100, rawScore));

      const { incidents: _incidents, ...rest } = student;
      return {
        ...rest,
        totalPraises: praises,
        totalIncidents: incidents,
        behaviorScore,
      };
    });
  }

  /**
   * Returns a full student profile with history feed for the drawer.
   */
  async getStudentProfile(
    schoolId: string,
    studentId: string,
    userId?: string,
    userRole?: string,
  ): Promise<StudentProfile> {
    // 0. Security Check if Parent
    if (userRole === UserRole.PARENT && userId) {
      const parentLink = await this.prisma.student.findFirst({
        where: { id: studentId, parentUsers: { some: { id: userId } } },
      });
      if (!parentLink) {
        throw new NotFoundException(`Student not found or not linked to your account`);
      }
    }

    // 1. Find current semester
    const semester = await this.prisma.semesterConfig.findFirst({
      where: { schoolId, isCurrent: true },
    });

    const semesterFilter = semester
      ? { dispatchedAt: { gte: semester.startDate, lte: semester.endDate } }
      : {};

    // 2. Fetch student with full incident history
    const student = await (this.prisma.student as any).findFirst({
      where: { id: studentId, schoolId },
      include: {
        incidents: {
          where: { schoolId, deletedAt: null },
          orderBy: { dispatchedAt: 'desc' },
          take: 50,
          include: {
            category: { select: { name: true, group: true } },
            createdBy: { select: { firstName: true, lastName: true } },
            triggeredActions: {
              include: {
                rule: { include: { category: { select: { name: true } } } },
                resolvedBy: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // 3. Compute semester-scoped stats
    const semesterIncidents = (student as any).incidents.filter((i: any) => {
      if (!semester) return true;
      return i.dispatchedAt >= semester.startDate && i.dispatchedAt <= semester.endDate;
    });

    const praises = semesterIncidents.filter(
      (i: any) => i.category.group === 'PRAISE',
    ).length;
    const incidents = semesterIncidents.filter(
      (i: any) => i.category.group === 'DISCIPLINE',
    ).length;
    const rawScore = 50 + 5 * praises - 10 * incidents;
    const behaviorScore = Math.max(0, Math.min(100, rawScore));
    const total = praises + incidents;
    const positivePercent = total > 0 ? Math.round((praises / total) * 100) : 50;

    // 4. Fetch all triggered actions for this student in the semester
    const semesterTriggeredActions = await (this.prisma.triggeredAction as any).findMany({
      where: {
        studentId,
        schoolId,
        deletedAt: null,
        ...(semester
          ? {
              OR: [
                { status: ActionStatus.PENDING },
                {
                  createdAt: { gte: semester.startDate, lte: semester.endDate },
                },
              ],
            }
          : {}),
      },
      include: {
        rule: { include: { category: { select: { name: true } } } },
        resolvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const triggeredActionSummaries: TriggeredActionSummary[] =
      semesterTriggeredActions.map((ta: any) => ({
        id: ta.id,
        actionType: ta.actionType,
        status: ta.status,
        count: ta.count,
        description: ta.rule.description,
        categoryName: ta.rule.category.name,
        threshold: ta.rule.threshold,
        incidentId: ta.incidentId,
        createdAt: ta.createdAt,
        resolutionOutcome: ta.resolutionOutcome ?? null,
        resolutionNote: ta.resolutionNote ?? null,
        resolvedAt: ta.resolvedAt ?? null,
        resolvedByName: ta.resolvedBy
          ? `${ta.resolvedBy.firstName} ${ta.resolvedBy.lastName}`
          : null,
      }));

    // 5. Build history feed with linked triggered actions
    const historyFeed: HistoryEntry[] = (student as any).incidents.map((i: any) => {
      // Find the first triggered action linked to this incident
      const linkedAction = i.triggeredActions?.[0];
      const actionSummary: TriggeredActionSummary | null = linkedAction
        ? {
            id: linkedAction.id,
            actionType: linkedAction.actionType,
            status: linkedAction.status,
            count: linkedAction.count,
            description: linkedAction.rule.description,
            categoryName: linkedAction.rule.category.name,
            threshold: linkedAction.rule.threshold,
            incidentId: i.id,
            createdAt: linkedAction.createdAt,
            resolutionOutcome: linkedAction.resolutionOutcome ?? null,
            resolutionNote: linkedAction.resolutionNote ?? null,
            resolvedAt: linkedAction.resolvedAt ?? null,
            resolvedByName: linkedAction.resolvedBy
              ? `${linkedAction.resolvedBy.firstName} ${linkedAction.resolvedBy.lastName}`
              : null,
          }
        : null;

      return {
        id: i.id,
        type: (i.category.group === 'PRAISE' ? 'PRAISE' : 'INCIDENT') as
          | 'PRAISE'
          | 'INCIDENT',
        categoryName: i.category.name,
        description: i.description ?? null,
        teacherName: `${i.createdBy.firstName} ${i.createdBy.lastName}`,
        dispatchedAt: i.dispatchedAt,
        triggeredAction: actionSummary,
      };
    });

    return {
      id: student.id,
      studentNo: student.studentNo,
      firstName: student.firstName,
      lastName: student.lastName,
      grade: student.grade,
      section: student.section,
      totalPraises: praises,
      totalIncidents: incidents,
      behaviorScore,
      positivePercent,
      historyFeed,
      triggeredActions: triggeredActionSummaries,
    };
  }

  /**
   * Returns students that have PENDING triggered actions (for Guide HUD flagging).
   */
  async getFlaggedStudents(schoolId: string): Promise<FlaggedStudent[]> {
    const students = await (this.prisma.student as any).findMany({
      where: {
        schoolId,
        triggeredActions: {
          some: {
            status: ActionStatus.PENDING,
            schoolId,
            deletedAt: null,
          },
        },
      },
      include: {
        triggeredActions: {
          where: { status: ActionStatus.PENDING, schoolId, deletedAt: null },
          include: {
            rule: { include: { category: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return students.map((s: any) => ({
      id: s.id,
      studentNo: s.studentNo,
      firstName: s.firstName,
      lastName: s.lastName,
      grade: s.grade,
      section: s.section,
      pendingActions: s.triggeredActions.map((ta: any) => ({
        id: ta.id,
        actionType: ta.actionType,
        status: ta.status,
        count: ta.count,
        description: ta.rule.description,
        categoryName: ta.rule.category.name,
        threshold: ta.rule.threshold,
        incidentId: ta.incidentId,
        createdAt: ta.createdAt,
        resolutionOutcome: null,
        resolutionNote: null,
        resolvedAt: null,
        resolvedByName: null,
      })),
    }));
  }

  async findAll(schoolId: string): Promise<Student[]> {
    const tenantDb = this.prisma.forTenant(schoolId);
    return (tenantDb.student as any).findMany({
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(schoolId: string, id: string): Promise<StudentWithIncidents> {
    const tenantDb = this.prisma.forTenant(schoolId);

    const student = await (tenantDb.student as any).findFirst({
      where: { id },
      include: {
        incidents: {
          where: { deletedAt: null },
          orderBy: { dispatchedAt: 'desc' },
          take: 10,
          include: {
            category: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return student as any;
  }

  async update(
    schoolId: string,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<Student> {
    await this.findOne(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.student.update({
      where: { id },
      data: dto,
    });
  }

  async delete(schoolId: string, id: string): Promise<Student> {
    await this.findOne(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.student.delete({
      where: { id },
    });
  }

  async search(schoolId: string, query: string): Promise<Student[]> {
    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.student.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { studentNo: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { lastName: 'asc' },
      take: 20,
    });
  }

  /**
   * Resolve a triggered action (flag clearance).
   * Sets status to COMPLETED and records resolution details.
   */
  async resolveTriggeredAction(
    schoolId: string,
    actionId: string,
    dto: ResolveTriggeredActionDto,
    userId: string,
  ) {
    // 1. Find and verify the triggered action
    const action = await (this.prisma.triggeredAction as any).findFirst({
      where: { id: actionId, schoolId, status: ActionStatus.PENDING, deletedAt: null },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!action) {
      throw new NotFoundException(
        `Triggered action ${actionId} not found or already resolved`,
      );
    }

    // 2. Update the triggered action
    const updated = await this.prisma.triggeredAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.COMPLETED,
        resolutionOutcome: dto.resolutionOutcome,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        resolvedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      triggeredActionId: updated.id,
      studentId: updated.student.id,
      studentName: `${updated.student.firstName} ${updated.student.lastName}`,
      resolvedByName: updated.resolvedBy
        ? `${updated.resolvedBy.firstName} ${updated.resolvedBy.lastName}`
        : 'Unknown',
      resolutionOutcome: updated.resolutionOutcome,
      timestamp: updated.resolvedAt,
    };
  }
}
