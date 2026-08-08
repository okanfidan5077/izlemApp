import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryGroup, Incident, Student } from '@prisma/client';
import { StudentProfileResponse } from './interfaces/student-profile.interface';

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get list of students linked to this parent
   */
  async getLinkedStudents(
    authorizedStudentIds: string[],
  ): Promise<Partial<Student>[]> {
    // If no ids, return empty (guard should catch this, but safe check)
    if (!authorizedStudentIds.length) return [];

    return this.prisma.student.findMany({
      where: { id: { in: authorizedStudentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNo: true,
        grade: true,
        section: true,
      },
    });
  }

  async getStudentProfile(
    schoolId: string,
    studentId: string,
  ): Promise<StudentProfileResponse> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: true,
      },
    });

    if (!student || student.schoolId !== schoolId) {
      throw new NotFoundException('Student not found');
    }

    const currentSemester = await this.prisma.semesterConfig.findFirst({
      where: { schoolId, isCurrent: true },
    });

    // Calculate stats for current semester (only visible ones)
    let totalIncidents = 0;
    let totalPraises = 0;

    if (currentSemester) {
      const incidents = await this.prisma.incident.findMany({
        where: {
          studentId,
          visibleToParent: true, // Only count visible incidents
          dispatchedAt: {
            gte: currentSemester.startDate,
            lte: currentSemester.endDate,
          },
        },
        include: { category: true },
      });

      totalIncidents = incidents.filter(
        (i) => i.category.group === CategoryGroup.DISCIPLINE,
      ).length;
      totalPraises = incidents.filter(
        (i) => i.category.group === CategoryGroup.PRAISE,
      ).length;
    }

    const total = totalIncidents + totalPraises;
    const positivePercent = total > 0 ? Math.round((totalPraises / total) * 100) : 50;
    const rawScore = 50 + 5 * totalPraises - 10 * totalIncidents;
    const behaviorScore = Math.max(0, Math.min(100, rawScore));

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentNo: student.studentNo,
        grade: student.grade,
        section: student.section,
      },
      semesterName: currentSemester?.name || 'No Active Semester',
      totalIncidents,
      totalPraises,
      behaviorScore,
      positivePercent
    };
  }

  async getIncidentHistory(
    schoolId: string,
    studentId: string,
  ): Promise<Incident[]> {
    const tenantDb = this.prisma.forTenant(schoolId);

    const incidents = await tenantDb.incident.findMany({
      where: {
        studentId,
        visibleToParent: true, // Enforce visibility filter
      },
      orderBy: { dispatchedAt: 'desc' },
      include: {
        category: true,
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        triggeredActions: {
          select: {
            id: true,
            actionType: true,
            createdAt: true,
            rule: {
              select: { description: true },
            },
          },
        },
      },
    });

    // Post-process to simplify triggered actions for parents
    return incidents.map(incident => ({
      ...incident,
      notes: null, // Use null to satisfy Prisma's string | null type
      triggeredActions: incident.triggeredActions.map(ta => ({
        ...ta,
        // If it's a rule-triggered action, we can simplify/customize the description if needed
        description: ta.rule?.description || ta.actionType
      }))
    })) as any; // Cast to any to avoid complex deep-mismatch lint errors
  }
}
