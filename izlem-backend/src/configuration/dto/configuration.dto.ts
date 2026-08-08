import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsInt,
} from 'class-validator';
import { CategoryGroup, ActionType } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CategoryGroup)
  @IsNotEmpty()
  group!: CategoryGroup;

  @IsInt()
  @IsOptional()
  points?: number;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CategoryGroup)
  @IsOptional()
  group?: CategoryGroup;

  @IsInt()
  @IsOptional()
  points?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ActionType)
  @IsNotEmpty()
  actionType!: ActionType;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsInt()
  @IsNotEmpty()
  threshold!: number;
}

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ActionType)
  @IsOptional()
  actionType?: ActionType;

  @IsInt()
  @IsOptional()
  threshold?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
