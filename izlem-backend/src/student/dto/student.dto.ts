import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  studentNo!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  section?: string;
}

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  section?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
