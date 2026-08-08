import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { IncidentStatus } from '@prisma/client';
import { IncidentsGateway } from './incidents.gateway';

/**
 * Incident Monitor Service
 *
 * Runs a scheduled task every minute to check for DISPATCHED incidents
 * that have not been received within the 15-minute SLA window.
 *
 * Business Logic:
 * - When an incident is created, status = DISPATCHED
 * - A guide teacher must acknowledge (receive) the incident within 15 minutes
 * - If receivedAt remains null after 15 minutes, status becomes UNACCOUNTED
 * - This triggers WebSocket alarm and affects accountability metrics
 */
@Injectable()
export class IncidentMonitorService {
  private readonly logger = new Logger(IncidentMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IncidentsGateway,
  ) {}

  /**
   * Cron job that runs every minute to check for timed-out incidents.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processIncidentTimeouts(): Promise<void> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    this.logger.debug(
      `Checking for DISPATCHED incidents older than ${fifteenMinutesAgo.toISOString()}`,
    );

    try {
      // Find incidents that are about to be marked as UNACCOUNTED
      const expiredIncidents = await this.prisma.incident.findMany({
        where: {
          status: IncidentStatus.DISPATCHED,
          receivedAt: null,
          dispatchedAt: {
            lte: fifteenMinutesAgo,
          },
        },
        include: {
          student: true,
          school: true,
        },
      });

      if (expiredIncidents.length === 0) {
        return;
      }

      // Update all expired incidents to UNACCOUNTED
      await this.prisma.incident.updateMany({
        where: {
          id: { in: expiredIncidents.map((i) => i.id) },
        },
        data: {
          status: IncidentStatus.UNACCOUNTED,
        },
      });

      this.logger.warn(
        `⚠️ Marked ${expiredIncidents.length} incident(s) as UNACCOUNTED after 15-minute timeout`,
      );

      // Emit alarm for each incident to their respective school rooms
      for (const incident of expiredIncidents) {
        const minutesOverdue = Math.round(
          (Date.now() - incident.dispatchedAt.getTime()) / 60000,
        );

        this.gateway.emitIncidentAlarm(incident.schoolId, {
          incidentId: incident.id,
          studentName: `${incident.student.firstName} ${incident.student.lastName}`,
          minutesOverdue,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to process incident timeouts',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Manual trigger for testing or admin override.
   */
  async runManualCheck(): Promise<{ processedCount: number }> {
    this.logger.log('Manual incident timeout check triggered');
    await this.processIncidentTimeouts();

    const count = await this.prisma.incident.count({
      where: { status: IncidentStatus.UNACCOUNTED },
    });

    return { processedCount: count };
  }
}
