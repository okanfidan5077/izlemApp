import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

export interface TenantUser {
  userId: string;
  email: string;
  role: string;
  schoolId: string;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof TenantUser | undefined,
    ctx: ExecutionContext,
  ): TenantUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TenantUser;

    return data ? user?.[data] : user;
  },
);

export const SchoolId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const schoolId = request.user?.schoolId;

    if (!schoolId) {
      throw new ForbiddenException('School ID not found in token');
    }

    return schoolId;
  },
);
