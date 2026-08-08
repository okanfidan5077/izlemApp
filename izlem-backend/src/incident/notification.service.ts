import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, NotificationStatus, CategoryGroup } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Send a branded notification to a parent when a rule triggers.
   */
  async sendParentNotification(
    schoolId: string,
    parent: { id: string; email: string; firstName: string; lastName: string; phone?: string | null },
    student: { firstName: string; lastName: string; studentNo: string },
    rule: {
      description: string;
      actionType: string;
      threshold: number;
      category: { name: string; group?: string | CategoryGroup }; // Accept enum or string
    },
  ): Promise<void> {
    const studentName = `${student.firstName} ${student.lastName}`;
    const subject = `İzlem Alert: ${rule.category.name} — ${studentName}`;
    const message = `Notification for ${studentName}: ${rule.description}`;

    this.logger.log(`Queueing notification for parent ${parent.email}`);

    // 1. Create DB Record (PENDING)
    const notification = await this.prisma.notification.create({
      data: {
        channel: NotificationChannel.EMAIL,
        subject,
        message,
        recipientId: parent.id,
        schoolId,
        status: NotificationStatus.PENDING,
      },
    });

    // 2. Add to Queue
    await this.notificationsQueue.add(
      'email',
      {
        notificationId: notification.id,
        schoolId,
        parent,
        student,
        rule,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    );

    // 3. Update DB to QUEUED
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.QUEUED },
    });

    // 4. SMS Check (If urgent)
    if (
      rule.actionType === 'ASSIGN_DETENTION' ||
      rule.actionType === 'REQUIRE_ADMIN_MEETING'
    ) {
        // Create separate notification? Or same?
        // Let's queue SMS job separately, but maybe link to same notification or create new one?
        // For simplicity, we create a new notification record for SMS channel if we want to track it separately.
        // OR reuse the ID if we want to track 'Notification' as a logical event.
        // But Schema has `channel`. So separate is better.
        
        // Let's queue SMS job. Implementation plan said "Update ... to store provider's messageId".
        // The core requirement is "The 'Watcher' ... adds a job ...".
        
        await this.notificationsQueue.add(
          'sms',
          {
            schoolId,
            parent,
            student,
            rule,
            // Link to email notification ID? Or create new?
            relatedNotificationId: notification.id, 
          },
          { attempts: 3, backoff: 5000 },
        );
    }
  }

  /**
   * Send praise email (kept for backward compatibility logic, redirects to common queue logic)
   * Note: The rule engine calls this separately? Or can we merge?
   * Rule Engine calls sendParentNotification for infractions.
   * If praise logic is separate, we adapt.
   */
  async sendPraiseEmail(
    schoolId: string,
    parent: { id: string; email: string; firstName: string; lastName: string },
    student: { firstName: string; lastName: string; studentNo: string },
    rule: {
      description: string;
      actionType: string;
      threshold: number;
      category: { name: string; group?: string };
    },
  ): Promise<void> {
    // Treat as normal notification but ensure rule has group=PRAISE
    // We can just call sendParentNotification if we ensure rule structure is compatible.
    // The processor handles the template based on category group.
    
    // Ensure group is set if missing (hacky but effective if caller didn't populate)
    if (!rule.category.group) {
        (rule.category as any).group = 'PRAISE';
    }

    await this.sendParentNotification(schoolId, parent, student, rule);
  }

  /**
   * Send Class Termination email notifications to all parents in the student's grade & section.
   */
  async sendClassTerminationNotifications(
    schoolId: string,
    teacher: { firstName: string; lastName: string },
    student: { grade?: string | null; section?: string | null },
    category: { name: string },
  ): Promise<void> {
    if (!student.grade && !student.section) {
      this.logger.warn('Student has no grade or section defined — skipping class termination email');
      return;
    }

    const classLabel = `${student.grade || ''}${student.section ? '-' + student.section : ''}`.trim() || 'Class';
    this.logger.log(`📢 Sending Class Termination notifications for Grade ${classLabel}`);

    // 1. Find all active students in this class/section
    const classStudents = await this.prisma.student.findMany({
      where: {
        schoolId,
        grade: student.grade ?? undefined,
        section: student.section ?? undefined,
        isActive: true,
      },
      include: {
        parentUsers: true,
      },
    });

    // 2. Deduplicate parents
    const parentsMap = new Map<string, { id: string; email: string; firstName: string; lastName: string }>();
    for (const s of classStudents) {
      if (s.parentUsers) {
        for (const p of s.parentUsers) {
          parentsMap.set(p.id, p);
        }
      }
    }

    if (parentsMap.size === 0) {
      this.logger.warn(`No parents linked to students in Grade ${classLabel}`);
      return;
    }

    this.logger.log(`Found ${parentsMap.size} unique parent(s) in Grade ${classLabel} to notify`);

    // 3. Queue emails for all parents
    for (const parent of parentsMap.values()) {
      const subject = `İzlem Alert: Class Termination — Grade ${classLabel}`;
      const message = `Teacher ${teacher.firstName} ${teacher.lastName}'s lesson for Grade ${classLabel} has been terminated due to ${category.name}.`;

      const notification = await this.prisma.notification.create({
        data: {
          channel: NotificationChannel.EMAIL,
          subject,
          message,
          recipientId: parent.id,
          schoolId,
          status: NotificationStatus.PENDING,
        },
      });

      await this.notificationsQueue.add(
        'class-termination-email',
        {
          notificationId: notification.id,
          parent,
          teacher,
          studentClass: { grade: student.grade, section: student.section },
          category,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        },
      );

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.QUEUED },
      });
    }
  }
}
