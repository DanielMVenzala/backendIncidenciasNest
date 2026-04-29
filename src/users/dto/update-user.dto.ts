import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { ValidRoles } from '../interfaces/valid-roles';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  fotoPerfil?: string;

  @IsOptional()
  @IsEnum(ValidRoles)
  rol?: ValidRoles;
}
