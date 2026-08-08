import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncidentService } from './incident.service';
import { IncidentController } from './incident.controller';
import { IncidentMonitorService } from './incident-monitor.service';
import { IncidentMonitorTask } from './tasks';
import { IncidentsGateway } from './incidents.gateway';
import { RuleEngineService } from './rule-engine.service';
import { NotificationService } from './notification.service';

import { BullModule } from '@nestjs/bull';
import { EmailTemplateService } from './email-template.service';
import { NotificationProcessor } from './notification.processor';

@Module({
  imports: [
    // JWT needed for gateway authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    // Async Queue
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [IncidentController],
  providers: [
    IncidentsGateway,
    IncidentService,
    IncidentMonitorService,
    IncidentMonitorTask,
    RuleEngineService,
    NotificationService,
    EmailTemplateService,
    NotificationProcessor,
  ],
  exports: [IncidentService, IncidentMonitorService, IncidentsGateway],
})
export class IncidentModule {}
