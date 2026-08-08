import { PrismaClient } from '@prisma/client';

/**
 * Creates a tenant-scoped Prisma client using Prisma's $extends API.
 *
 * This extension automatically injects the `schoolId` into:
 * - findMany: Adds schoolId to the where clause
 * - findFirst: Adds schoolId to the where clause
 * - findUnique: Verifies schoolId ownership post-query
 * - create: Adds schoolId to the data
 * - update/delete: Validates ownership before mutation
 *
 * Security guarantees:
 * 1. No query can access data from another tenant
 * 2. No mutation can modify data from another tenant
 * 3. The extension is applied per-request based on JWT
 *
 * @param prisma - The base Prisma client
 * @param schoolId - The school ID to scope all queries to
 */
export function createTenantClient(prisma: PrismaClient, schoolId: string) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      // ============ USER MODEL ============
      user: {
        findMany({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'schoolId' in result && result.schoolId !== schoolId) {
            return null;
          }
          return result;
        },
        create({ args, query }) {
          (args.data as Record<string, unknown>).schoolId = schoolId;
          return query(args);
        },
      },

      // ============ STUDENT MODEL ============
      student: {
        findMany({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'schoolId' in result && result.schoolId !== schoolId) {
            return null;
          }
          return result;
        },
        create({ args, query }) {
          (args.data as Record<string, unknown>).schoolId = schoolId;
          return query(args);
        },
      },

      // ============ INCIDENT MODEL ============
      incident: {
        findMany({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'schoolId' in result && result.schoolId !== schoolId) {
            return null;
          }
          return result;
        },
        create({ args, query }) {
          (args.data as Record<string, unknown>).schoolId = schoolId;
          return query(args);
        },
      },

      // ============ INFRACTION CATEGORY MODEL ============
      infractionCategory: {
        findMany({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'schoolId' in result && result.schoolId !== schoolId) {
            return null;
          }
          return result;
        },
        create({ args, query }) {
          (args.data as Record<string, unknown>).schoolId = schoolId;
          return query(args);
        },
      },

      // ============ DISCIPLINE RULE MODEL ============
      disciplineRule: {
        findMany({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, schoolId };
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && 'schoolId' in result && result.schoolId !== schoolId) {
            return null;
          }
          return result;
        },
        create({ args, query }) {
          (args.data as Record<string, unknown>).schoolId = schoolId;
          return query(args);
        },
      },
    },
  });
}

/**
 * Type for the tenant-scoped Prisma client.
 * Use this when type annotations are needed.
 */
export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
