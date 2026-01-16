import {
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  IncidentPriority,
  IncidentState,
} from 'src/incidents/entities/incident.entity';
import { PaginationDto } from './pagination.dto';

export enum OrderDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum IncidentOrderBy {
  creadoEn = 'creadoEn',
  actualizadoEn = 'actualizadoEn',
}

export class FindIncidentsQueryDto extends PaginationDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  titulo?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  direccion?: string;

  @IsEnum(IncidentState)
  @IsOptional()
  estado?: IncidentState;

  @IsEnum(IncidentPriority)
  @IsOptional()
  prioridad?: IncidentPriority;

  @IsOptional()
  @IsString()
  @MinLength(3)
  search?: string;

  @IsOptional()
  @IsEnum(IncidentOrderBy)
  //Si viene orderBy tiene que ser creadoEn o actualizadoEn
  orderBy?: IncidentOrderBy;

  @IsOptional()
  @IsEnum(OrderDirection)
  //Si viene order tiene que ser ASC o DESC
  order?: OrderDirection;
}
