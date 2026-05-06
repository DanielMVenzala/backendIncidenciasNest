import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

//Cómo vamos a construir cada usuario en la insercción
export class CreateUserDto {
  @ApiProperty({
    description: 'User name',
    nullable: false,
    minLength: 1,
  })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  nombre: string;

  @ApiProperty({
    description: 'User e-mail',
    nullable: false,
  })
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({
    description: 'User password',
    nullable: false,
    minLength: 8,
  })
  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  })
  clave: string;
}
