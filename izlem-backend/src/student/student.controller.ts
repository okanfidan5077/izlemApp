import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto, UpdateStudentDto, ResolveTriggeredActionDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { SchoolId, CurrentUser, TenantUser } from '../common/decorators';
import { UserRole } from '@prisma/client';
import { IncidentsGateway } from '../incident/incidents.gateway';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly incidentsGateway: IncidentsGateway,
  ) {}

  @Post()
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  create(
    @SchoolId() schoolId: string,
    @Body() createStudentDto: CreateStudentDto,
  ) {
    return this.studentService.create(schoolId, createStudentDto);
  }

  /**
   * GET /students — returns all students with behavioral stats.
   * Parents only see their own linked students.
   */
  @Get()
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN, UserRole.PARENT)
  findAll(
    @SchoolId() schoolId: string,
    @CurrentUser() user: TenantUser,
  ) {
    return this.studentService.findAllWithStats(schoolId, user.userId, user.role);
  }

  @Get('search')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  search(@SchoolId() schoolId: string, @Query('q') query: string) {
    return this.studentService.search(schoolId, query);
  }

  /**
   * GET /students/flagged — students with PENDING triggered actions (Guide HUD).
   */
  @Get('flagged')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  getFlaggedStudents(@SchoolId() schoolId: string) {
    return this.studentService.getFlaggedStudents(schoolId);
  }

  /**
   * GET /students/:id/profile — full behavioral profile for the drawer.
   */
  @Get(':id/profile')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN, UserRole.PARENT)
  getProfile(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: TenantUser,
  ) {
    return this.studentService.getStudentProfile(schoolId, id, user.userId, user.role);
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findOne(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.studentService.findOne(schoolId, id);
  }

  @Patch(':id')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  update(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.studentService.update(schoolId, id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.studentService.delete(schoolId, id);
  }

  /**
   * PATCH /students/triggered-actions/:id/resolve
   * Resolve a triggered action (flag clearance).
   */
  @Patch('triggered-actions/:id/resolve')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  async resolveTriggeredAction(
    @SchoolId() schoolId: string,
    @Param('id') actionId: string,
    @Body() dto: ResolveTriggeredActionDto,
    @CurrentUser() user: TenantUser,
  ) {
    const result = await this.studentService.resolveTriggeredAction(
      schoolId,
      actionId,
      dto,
      user.userId,
    );

    // Emit WebSocket event for real-time HUD cleanup
    this.incidentsGateway.emitFlagResolved(schoolId, {
      triggeredActionId: result.triggeredActionId,
      studentId: result.studentId,
      resolvedByName: result.resolvedByName,
      resolutionOutcome: result.resolutionOutcome ?? '',
      timestamp: result.timestamp ?? new Date(),
    });

    return result;
  }
}
