import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email del usuario que olvidó su contraseña' })
  @IsEmail({}, { message: 'Email no válido' })
  email: string;
}
