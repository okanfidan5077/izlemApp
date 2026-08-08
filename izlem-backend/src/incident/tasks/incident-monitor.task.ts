import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma';
import { IncidentStatus } from '@prisma/client';

@Injectable()
export class IncidentMonitorTask {
  private readonly logger = new Logger(IncidentMonitorTask.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Monitors DISPATCHED incidents and marks them as UNACCOUNTED
   * if receivedAt remains null after 15 minutes
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleIncidentTimeout(): Promise<void> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    try {
      const result = await this.prisma.incident.updateMany({
        where: {
          status: IncidentStatus.DISPATCHED,
          receivedAt: null,
          dispatchedAt: {
            lte: fifteenMinutesAgo,
          },
        },
        data: {
          status: IncidentStatus.UNACCOUNTED,
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Marked ${result.count} incident(s) as UNACCOUNTED after 15-minute timeout`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to process incident timeouts', error);
    }
  }
}
