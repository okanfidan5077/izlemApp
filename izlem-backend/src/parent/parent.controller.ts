import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ParentGuard } from './parent.guard';
import { ParentService } from './parent.service';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('parent')
@Roles(UserRole.PARENT)
@UseGuards(ParentGuard)
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  /**
   * GET /parent/students
   * Returns list of students linked to the logged-in parent.
   */
  @Get('students')
  async getStudents(@Req() req: AuthenticatedRequest) {
    const { user } = req;
    if (!user.studentIds) return [];
    return this.parentService.getLinkedStudents(user.studentIds);
  }

  /**
   * GET /parent/student-profile
   * Returns the linked student's profile and semester stats.
   * Defaults to first student if none specified.
   */
  @Get('student-profile')
  async getStudentProfile(@Req() req: AuthenticatedRequest) {
    const { schoolId, user, query } = req;
    // Guard ensures query.studentId is authorized if present
    const targetStudentId =
      (query.studentId as string) ||
      (user.studentIds ? user.studentIds[0] : '');
    return this.parentService.getStudentProfile(schoolId, targetStudentId);
  }

  /**
   * GET /parent/incident-history
   * Returns all incidents for the linked student, sorted by date desc.
   * Defaults to first student if none specified.
   */
  @Get('incident-history')
  async getIncidentHistory(@Req() req: AuthenticatedRequest) {
    const { schoolId, user, query } = req;
    const targetStudentId =
      (query.studentId as string) ||
      (user.studentIds ? user.studentIds[0] : '');
    return this.parentService.getIncidentHistory(schoolId, targetStudentId);
  }
}
