import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionType } from '@prisma/client';
import { IncidentsGateway } from './incidents.gateway';
import { NotificationService } from './notification.service';
import {
  Student,
  DisciplineRule,
  User,
  InfractionCategory,
} from '@prisma/client';

type StudentWithParents = Student & { parentUsers: User[] };
type RuleWithCategory = DisciplineRule & { category: InfractionCategory };

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IncidentsGateway,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Evaluate all active rules for a student+category after a new incident.
   * Semester-aware: only counts incidents within the active semester window.
   */
  async evaluateRules(
    schoolId: string,
    studentId: string,
    categoryId: string,
    incidentId: string,
  ): Promise<void> {
    try {
      // 1. Get the active semester date range
      const semester = await this.prisma.semesterConfig.findFirst({
        where: { schoolId, isCurrent: true },
      });

      if (!semester) {
        this.logger.warn(
          'No active semester configured — skipping rule evaluation',
        );
        return;
      }

      // 2. Count incidents for this student+category within the semester
      const count = await this.prisma.incident.count({
        where: {
          schoolId,
          studentId,
          categoryId,
          createdAt: {
            gte: semester.startDate,
            lte: semester.endDate,
          },
        },
      });

      this.logger.log(
        `📊 Student ${studentId} has ${count} incident(s) for category ${categoryId} this semester`,
      );

      // 3. Find rules that match this exact threshold count
      const matchingRules = await this.prisma.disciplineRule.findMany({
        where: {
          schoolId,
          categoryId,
          threshold: count,
          isActive: true,
        },
        include: {
          category: true,
        },
      });

      if (matchingRules.length === 0) {
        this.logger.debug(`No rules triggered for count=${count}`);
        return;
      }

      // 4. Get student details for notifications
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: { parentUsers: true },
      });

      if (!student) return;

      // 5. Process each matching rule
      for (const rule of matchingRules) {
        // Check if this rule was already triggered for this incident
        const existing = await this.prisma.triggeredAction.findFirst({
          where: { ruleId: rule.id, incidentId },
        });
        if (existing) continue;

        // Create TriggeredAction record
        const triggeredAction = await this.prisma.triggeredAction.create({
          data: {
            actionType: rule.actionType,
            count,
            studentId,
            ruleId: rule.id,
            incidentId,
            schoolId,
          },
          include: {
            student: true,
            rule: { include: { category: true } },
          },
        });

        this.logger.warn(
          `⚡ RULE TRIGGERED: ${rule.actionType} for ${student.firstName} ${student.lastName} — ${rule.category.name} (count: ${count}, threshold: ${rule.threshold})`,
        );

        // 6. Emit WebSocket event to admin dashboard
        this.gateway.emitRuleTriggered(schoolId, {
          triggeredActionId: triggeredAction.id,
          studentName: `${student.firstName} ${student.lastName}`,
          categoryName: rule.category.name,
          actionType: rule.actionType,
          count,
          threshold: rule.threshold,
          description: rule.description,
          timestamp: triggeredAction.createdAt,
        });

        // 7. Execute action-specific logic
        await this.executeAction(schoolId, rule.actionType, student, rule, triggeredAction.id, count);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Rule evaluation failed: ${msg}`, stack);
    }
  }

  // ... existing code ...

  /**
   * Execute action-specific logic based on the rule type.
   */
  private async executeAction(
    schoolId: string,
    actionType: ActionType,
    student: StudentWithParents,
    rule: RuleWithCategory,
    triggeredActionId?: string,
    count?: number,
  ): Promise<void> {
    const studentName = `${student.firstName} ${student.lastName}`;

    switch (actionType) {
      case ActionType.LOG_WARNING:
        this.logger.log(
          `📝 Warning logged for ${studentName}: ${rule.description}`,
        );
        break;

      case ActionType.NOTIFY_PARENT:
        // Find parent users linked to this student
        if (student.parentUsers && student.parentUsers.length > 0) {
          for (const parent of student.parentUsers) {
            await this.notificationService.sendParentNotification(
              schoolId,
              parent,
              student,
              rule,
            );
          }
        } else {
          this.logger.warn(
            `⚠️ No parent linked to student ${studentName} — cannot send notification`,
          );
        }
        break;

      case ActionType.REQUIRE_ADMIN_MEETING:
        this.logger.log(
          `🤝 Admin meeting required for ${studentName}: ${rule.description}`,
        );
        // Emit student_flagged event for Guide HUD
        if (triggeredActionId) {
          this.gateway.emitStudentFlagged(schoolId, {
            studentId: student.id,
            studentName,
            actionType: rule.actionType,
            description: rule.description,
            categoryName: rule.category.name,
            count: count ?? 0,
            threshold: rule.threshold,
            triggeredActionId,
            timestamp: new Date(),
          });
        }
        break;

      case ActionType.ASSIGN_DETENTION:
        this.logger.log(
          `🔒 Detention assigned for ${studentName}: ${rule.description}`,
        );
        // Emit student_flagged event for Guide HUD
        if (triggeredActionId) {
          this.gateway.emitStudentFlagged(schoolId, {
            studentId: student.id,
            studentName,
            actionType: rule.actionType,
            description: rule.description,
            categoryName: rule.category.name,
            count: count ?? 0,
            threshold: rule.threshold,
            triggeredActionId,
            timestamp: new Date(),
          });
        }
        break;

      case ActionType.POSITIVE_REWARD:
        this.logger.log(
          `🌟 Positive reward for ${studentName}: ${rule.description}`,
        );
        if (student.parentUsers && student.parentUsers.length > 0) {
          for (const parent of student.parentUsers) {
            await this.notificationService.sendPraiseEmail(
              schoolId,
              parent,
              student,
              rule,
            );
          }
        }
        break;
    }
  }
}
