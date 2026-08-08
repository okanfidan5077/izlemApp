import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { SchoolId } from '../common/decorators';
import { UserRole } from '@prisma/client';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpsertSemesterDto } from './dto/upsert-semester.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/stats
   */
  @Get('stats')
  getStats(@SchoolId() schoolId: string) {
    return this.adminService.getStats(schoolId);
  }

  /**
   * GET /admin/users?search=&status=active|pending
   */
  @Get('users')
  getUsers(
    @SchoolId() schoolId: string,
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'pending',
  ) {
    return this.adminService.getUsers(schoolId, search, status);
  }

  /**
   * PATCH /admin/users/:id/status
   */
  @Patch('users/:id/status')
  setUserStatus(
    @SchoolId() schoolId: string,
    @Param('id') userId: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    return this.adminService.setUserStatus(schoolId, userId, body.isActive);
  }

  /**
   * POST /admin/users/:id/reset-password
   */
  @Post('users/:id/reset-password')
  resetPassword(
    @SchoolId() schoolId: string,
    @Param('id') userId: string,
    @Body() body: ResetUserPasswordDto,
  ) {
    return this.adminService.resetUserPassword(schoolId, userId, body.password);
  }

  /**
   * DELETE /admin/users/:id
   */
  @Delete('users/:id')
  deleteUser(@SchoolId() schoolId: string, @Param('id') userId: string) {
    return this.adminService.deleteUser(schoolId, userId);
  }

  /**
   * GET /admin/triggered-actions
   */
  @Get('triggered-actions')
  getTriggeredActions(@SchoolId() schoolId: string) {
    return this.adminService.getTriggeredActions(schoolId);
  }

  /**
   * GET /admin/semester
   */
  @Get('semester')
  getCurrentSemester(@SchoolId() schoolId: string) {
    return this.adminService.getCurrentSemester(schoolId);
  }

  /**
   * POST /admin/semester
   */
  @Post('semester')
  upsertSemester(
    @SchoolId() schoolId: string,
    @Body() body: UpsertSemesterDto,
  ) {
    return this.adminService.upsertSemester(schoolId, {
      name: body.name,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  /**
   * PATCH /admin/triggered-actions/:id/cancel
   */
  @Patch('triggered-actions/:id/cancel')
  cancelTriggeredAction(
    @SchoolId() schoolId: string,
    @Param('id') actionId: string,
  ) {
    return this.adminService.cancelTriggeredAction(schoolId, actionId);
  }

  // ==================== ANALYTICS ====================

  /**
   * GET /admin/analytics/outcome-stats
   */
  @Get('analytics/outcome-stats')
  getOutcomeStats(@SchoolId() schoolId: string) {
    return this.adminService.getOutcomeStats(schoolId);
  }

  /**
   * GET /admin/analytics/incident-trends
   */
  @Get('analytics/incident-trends')
  getIncidentTrends(@SchoolId() schoolId: string) {
    return this.adminService.getIncidentTrends(schoolId);
  }

  /**
   * GET /admin/analytics/top-categories
   */
  @Get('analytics/top-categories')
  getTopCategories(@SchoolId() schoolId: string) {
    return this.adminService.getTopCategories(schoolId);
  }
}
