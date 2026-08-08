import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== 'PARENT') {
      throw new ForbiddenException('Only parents can access this resource');
    }

    // Look up the user's linked students
    const parentUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        students: {
          select: { id: true },
        },
      },
    });

    if (
      !parentUser ||
      !parentUser.students ||
      parentUser.students.length === 0
    ) {
      throw new ForbiddenException(
        'Your account is not linked to any student. Please contact school administration.',
      );
    }

    // Attach studentIds to request for controller/service use
    const authorizedStudentIds = parentUser.students.map((s) => s.id);
    request.user.studentIds = authorizedStudentIds;

    // If a specific studentId is requested (query param 'studentId'), validate it
    const requestedStudentId = request.query.studentId;
    if (
      requestedStudentId &&
      !authorizedStudentIds.includes(requestedStudentId)
    ) {
      throw new ForbiddenException(
        'You are not authorized to view this student.',
      );
    }

    // Default to the first student if not specified (for controllers that need a single ID)
    if (!requestedStudentId) {
      request.studentId = authorizedStudentIds[0];
    } else {
      request.studentId = requestedStudentId;
    }

    return true;
  }
}
