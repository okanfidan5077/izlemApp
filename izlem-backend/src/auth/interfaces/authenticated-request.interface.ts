import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
    studentIds?: string[];
  };
  schoolId: string;
  tenantId: string;
}
