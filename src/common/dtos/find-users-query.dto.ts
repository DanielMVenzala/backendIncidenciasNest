import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { UserRole } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

//DTO para la búsqueda de usuarios con filtros
export class FindUsersQueryDto extends PaginationDto {
  @ApiProperty()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @ApiProperty()
  @IsOptional()
  @IsEnum(UserRole)
  rol?: UserRole;
}
