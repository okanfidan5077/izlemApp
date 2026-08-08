import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplateService } from './email-template.service';
import { NotificationStatus } from '@prisma/client';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  @Process('email')
  async handleEmail(job: Job<any>) {
    const { notificationId, parent, student, rule } = job.data;
    this.logger.debug(`Processing EMAIL job for notification ${notificationId}`);

    try {
      // 1. Update status to QUEUED (or PROCESSING)
      // Actually, we set it to QUEUED when enqueuing. Here we are processing.
      
      // 2. Generate content
      let htmlEmail: string;
      if (rule.category.group === 'PRAISE') {
        htmlEmail = this.emailTemplateService.getPraiseNotificationTemplate(
            parent,
            student,
            rule,
        );
      } else {
        htmlEmail = this.emailTemplateService.getParentNotificationTemplate(
            parent,
            student,
            rule,
            this.getActionLabel(rule.actionType),
        );
      }

      // 3. Simulate Sending (Replace with real SMTP call)
      this.logger.log(`📧 SENDING EMAIL to ${parent.email} [${notificationId}]`);
      // awaited call to smtpService...

      // 4. Update DB on Success
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(`✅ Email sent successfully: ${notificationId}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error instanceof Error ? error.message : error}`);
      throw error; // Trigger retry
    }
  }

  @Process('sms')
  async handleSms(job: Job<any>) {
    const { notificationId, parent, student, rule } = job.data;
    this.logger.debug(`Processing SMS job for notification ${notificationId}`);

    // SMS Logic only for urgent actions
    if (
      rule.actionType !== 'ASSIGN_DETENTION' &&
      rule.actionType !== 'REQUIRE_ADMIN_MEETING'
    ) {
        this.logger.log(`Skipping SMS for non-urgent action: ${rule.actionType}`);
        return;
    }

    try {
      const message = `İzlem: Important update for ${student.firstName}. Please check your portal for details.`;
      
      this.logger.log(`📱 SENDING SMS to ${parent.phone || 'No Phone'} [${notificationId}]: ${message}`);
      // awaited call to smsService...

      // Update DB? 
      // Note: If we have separate Notification records for SMS, update them.
      // If this job is linked to the EMAIL notification, we might not want to overwrite status.
      // Assumption: The system creates a separate Notification record for SMS channel if needed.
    } catch (error) {
       this.logger.error(`Failed to send SMS: ${error instanceof Error ? error.message : error}`);
       throw error;
    }
  }

  @Process('chat-email')
  async handleChatEmail(job: Job<any>) {
    const { notificationId, senderName, recipient } = job.data;
    this.logger.debug(`Processing CHAT-EMAIL job for notification ${notificationId}`);

    try {
      // Simulate sending email
      this.logger.log(
        `📧 SENDING CHAT EMAIL to ${recipient.email} [${notificationId}]: ` +
        `"You have a new message from ${senderName}. Log in to your İzlem portal to respond."`,
      );

      // Update DB on success
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(`✅ Chat email sent successfully: ${notificationId}`);
    } catch (error) {
      this.logger.error(`Failed to send chat email: ${error instanceof Error ? error.message : error}`);
      throw error; // Trigger retry
    }
  }

  @Process('class-termination-email')
  async handleClassTerminationEmail(job: Job<any>) {
    const { notificationId, parent, teacher, studentClass, category } = job.data;
    this.logger.debug(`Processing CLASS-TERMINATION-EMAIL job for notification ${notificationId}`);

    try {
      const htmlEmail = this.emailTemplateService.getClassTerminationTemplate(
        parent,
        teacher,
        studentClass,
        category,
      );

      this.logger.log(
        `🚨 SENDING CLASS TERMINATION EMAIL to ${parent.email} [${notificationId}]: ` +
        `Teacher ${teacher.firstName} ${teacher.lastName}'s lesson for Grade ${studentClass.grade || ''}-${studentClass.section || ''} terminated due to ${category.name}`,
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        },
      });

      this.logger.log(`✅ Class termination email sent successfully: ${notificationId}`);
    } catch (error) {
      this.logger.error(`Failed to send class termination email: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error) {
    const { notificationId } = job.data;
    this.logger.error(`❌ Job ${job.id} failed: ${error.message}`);

    if (notificationId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          error: error.message,
        },
      });
    }
  }

  private getActionLabel(actionType: string): string {
    const labels: Record<string, string> = {
      LOG_WARNING: 'Warning Logged',
      NOTIFY_PARENT: 'Parent Notification',
      REQUIRE_ADMIN_MEETING: 'Admin Meeting Required',
      ASSIGN_DETENTION: 'Detention Assigned',
      POSITIVE_REWARD: 'Positive Reward',
    };
    return labels[actionType] || actionType;
  }
}
