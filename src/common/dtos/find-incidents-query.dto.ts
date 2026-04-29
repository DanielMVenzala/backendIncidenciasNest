import {
  IsDateString,
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

//DTO para establecer los filtros de búsqueda de incidentes
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
  orderBy?: IncidentOrderBy;

  @IsOptional()
  @IsEnum(OrderDirection)
  order?: OrderDirection;

  // Filtros por rango de fechas (formato ISO: 2026-03-01)
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
