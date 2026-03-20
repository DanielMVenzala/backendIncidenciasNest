import { PartialType } from '@nestjs/swagger';
import { CreateIncidentDto } from './create-incident.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IncidentState } from '../entities/incident.entity';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @ApiProperty({
    description: 'Incident state',
    enum: IncidentState,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentState)
  estado?: IncidentState;
}
