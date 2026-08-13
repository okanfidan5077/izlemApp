import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from './prisma';
import { AuthModule, JwtAuthGuard, RolesGuard } from './auth';
import { IncidentModule } from './incident';
import { StudentModule } from './student';
import { ConfigurationModule } from './configuration';
import { AdminModule } from './admin/admin.module';
import { ParentModule } from './parent/parent.module';
import { ChatModule } from './chat/chat.module';
import {
  GlobalResponseInterceptor,
  TenantInterceptor,
} from './common/interceptors';
import { GlobalExceptionFilter } from './common/filters';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduled tasks (Cron jobs)
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    IncidentModule,
    StudentModule,
    ConfigurationModule,
    AdminModule,
    ParentModule,
    ChatModule,

    // Async Queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            redis: {
              tls: redisUrl.startsWith('rediss://')
                ? { rejectUnauthorized: false }
                : undefined,
            },
            url: redisUrl,
          };
        }
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: Number(configService.get<string>('REDIS_PORT')) || 6379,
            password: configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Global exception filter for standardized error responses
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard for RBAC
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Tenant context interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    // Global response interceptor for standardized JSON envelopes
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalResponseInterceptor,
    },
  ],
})
export class AppModule {}
