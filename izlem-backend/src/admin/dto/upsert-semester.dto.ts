import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class UpsertSemesterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
