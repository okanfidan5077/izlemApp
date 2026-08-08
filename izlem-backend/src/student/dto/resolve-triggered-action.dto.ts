import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ResolutionOutcome } from '@prisma/client';

export class ResolveTriggeredActionDto {
  @IsEnum(ResolutionOutcome)
  @IsNotEmpty()
  resolutionOutcome!: ResolutionOutcome;

  @IsString()
  @IsNotEmpty()
  resolutionNote!: string;
}
