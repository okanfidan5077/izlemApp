import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TenantInterceptor extracts the schoolId from the JWT payload
 * and attaches it to the request for downstream use.
 *
 * This ensures tenant context is always available throughout
 * the request lifecycle.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Attach tenant context to request for easy access
    if (user?.schoolId) {
      request.tenantId = user.schoolId;
      request.schoolId = user.schoolId;
    }

    return next.handle();
  }
}
