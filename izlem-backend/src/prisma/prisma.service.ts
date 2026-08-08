import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantClient } from '../common/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Creates a tenant-scoped Prisma client that automatically filters
   * and injects schoolId into all queries for multi-tenant models.
   *
   * Security: All queries through this client are automatically scoped
   * to the specified school, preventing cross-tenant data access.
   *
   * Usage:
   * ```typescript
   * const tenantDb = this.prisma.forTenant(schoolId);
   * const students = await tenantDb.student.findMany();
   * // ^ Automatically filtered by schoolId
   * ```
   *
   * @param schoolId - The school ID extracted from JWT
   * @returns A Prisma client extended with tenant isolation
   */
  forTenant(schoolId: string) {
    return createTenantClient(this, schoolId);
  }
}
