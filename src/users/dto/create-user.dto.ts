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
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({
    description: 'User e-mail',
    nullable: false,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    nullable: false,
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  })
  clave: string;
}
