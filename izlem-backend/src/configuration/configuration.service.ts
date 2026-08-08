import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateRuleDto,
  UpdateRuleDto,
} from './dto';
import { CategoryGroup } from '@prisma/client';

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CATEGORIES ====================

  async createCategory(schoolId: string, dto: CreateCategoryDto) {
    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.infractionCategory.create({
      data: {
        ...dto,
        schoolId, // Explicit for TypeScript; extension also enforces
      },
    });
  }

  async findAllCategories(schoolId: string, group?: CategoryGroup) {
    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.infractionCategory.findMany({
      where: group ? { group } : undefined,
      include: {
        disciplineRules: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneCategory(schoolId: string, id: string) {
    const tenantDb = this.prisma.forTenant(schoolId);

    const category = await tenantDb.infractionCategory.findFirst({
      where: { id },
      include: {
        disciplineRules: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async updateCategory(schoolId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOneCategory(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.infractionCategory.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(schoolId: string, id: string) {
    await this.findOneCategory(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.infractionCategory.delete({
      where: { id },
    });
  }

  // ==================== RULES ====================

  async createRule(schoolId: string, dto: CreateRuleDto) {
    const tenantDb = this.prisma.forTenant(schoolId);

    // Verify category exists
    await this.findOneCategory(schoolId, dto.categoryId);

    return tenantDb.disciplineRule.create({
      data: {
        ...dto,
        schoolId, // Explicit for TypeScript; extension also enforces
      },
      include: {
        category: true,
      },
    });
  }

  async findAllRules(schoolId: string, categoryId?: string) {
    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.disciplineRule.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
      },
      orderBy: { description: 'asc' },
    });
  }

  async findOneRule(schoolId: string, id: string) {
    const tenantDb = this.prisma.forTenant(schoolId);

    const rule = await tenantDb.disciplineRule.findFirst({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }

    return rule;
  }

  async updateRule(schoolId: string, id: string, dto: UpdateRuleDto) {
    await this.findOneRule(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.disciplineRule.update({
      where: { id },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async deleteRule(schoolId: string, id: string) {
    await this.findOneRule(schoolId, id);

    const tenantDb = this.prisma.forTenant(schoolId);

    return tenantDb.disciplineRule.delete({
      where: { id },
    });
  }
}
