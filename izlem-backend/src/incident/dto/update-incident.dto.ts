import { PartialType } from '@nestjs/mapped-types';
import { CreateIncidentDto } from './create-incident.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;
}
