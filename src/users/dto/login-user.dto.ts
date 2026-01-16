import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

//Cómo vamos a construir cada usuario en la insercción
export class LoginUserDto {
  @ApiProperty({
    description: 'User email',
    nullable: false,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    nullable: false,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have a Uppercase, lowercase letter and a number',
  })
  clave: string;
}
