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
import { IncidentService } from './incident.service';
import { CreateIncidentDto, UpdateIncidentDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { CurrentUser, SchoolId, TenantUser } from '../common/decorators';
import { IncidentStatus, UserRole } from '@prisma/client';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  create(
    @SchoolId() schoolId: string,
    @CurrentUser() user: TenantUser,
    @Body() createIncidentDto: CreateIncidentDto,
  ) {
    return this.incidentService.create(
      schoolId,
      user.userId,
      createIncidentDto,
    );
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findAll(
    @SchoolId() schoolId: string,
    @Query('status') status?: IncidentStatus,
    @Query('today') today?: string,
  ) {
    if (status) {
      return this.incidentService.findByStatus(schoolId, status);
    }
    return this.incidentService.findAll(schoolId, today === 'true');
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findOne(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.incidentService.findOne(schoolId, id);
  }

  @Patch(':id')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  update(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ) {
    return this.incidentService.update(schoolId, id, updateIncidentDto);
  }

  @Patch(':id/receive')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  receive(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: TenantUser,
  ) {
    return this.incidentService.receive(schoolId, id, user.userId);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  resolve(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @CurrentUser() user: TenantUser,
  ) {
    return this.incidentService.resolve(schoolId, id, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.incidentService.delete(schoolId, id);
  }
}
