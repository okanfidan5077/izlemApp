import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isLessonTerminated?: boolean;

  @IsBoolean()
  @IsOptional()
  isClassTerminated?: boolean;
}
