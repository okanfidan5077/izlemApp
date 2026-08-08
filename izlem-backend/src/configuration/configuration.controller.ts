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
import { ConfigurationService } from './configuration.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateRuleDto,
  UpdateRuleDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { SchoolId } from '../common/decorators';
import { CategoryGroup, UserRole } from '@prisma/client';

@Controller('configuration')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  // ==================== CATEGORIES ====================

  @Post('categories')
  @Roles(UserRole.ADMIN)
  createCategory(@SchoolId() schoolId: string, @Body() dto: CreateCategoryDto) {
    return this.configurationService.createCategory(schoolId, dto);
  }

  @Get('categories')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findAllCategories(
    @SchoolId() schoolId: string,
    @Query('group') group?: CategoryGroup,
  ) {
    return this.configurationService.findAllCategories(schoolId, group);
  }

  @Get('categories/:id')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findOneCategory(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.configurationService.findOneCategory(schoolId, id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN)
  updateCategory(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.configurationService.updateCategory(schoolId, id, dto);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN)
  deleteCategory(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.configurationService.deleteCategory(schoolId, id);
  }

  // ==================== RULES ====================

  @Post('rules')
  @Roles(UserRole.ADMIN)
  createRule(@SchoolId() schoolId: string, @Body() dto: CreateRuleDto) {
    return this.configurationService.createRule(schoolId, dto);
  }

  @Get('rules')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN, UserRole.PARENT)
  findAllRules(
    @SchoolId() schoolId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.configurationService.findAllRules(schoolId, categoryId);
  }

  @Get('rules/:id')
  @Roles(UserRole.TEACHER, UserRole.GUIDE_TEACHER, UserRole.ADMIN)
  findOneRule(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.configurationService.findOneRule(schoolId, id);
  }

  @Patch('rules/:id')
  @Roles(UserRole.ADMIN)
  updateRule(
    @SchoolId() schoolId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.configurationService.updateRule(schoolId, id, dto);
  }

  @Delete('rules/:id')
  @Roles(UserRole.ADMIN)
  deleteRule(@SchoolId() schoolId: string, @Param('id') id: string) {
    return this.configurationService.deleteRule(schoolId, id);
  }
}
