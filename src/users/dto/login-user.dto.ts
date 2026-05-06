import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * DTO para el login.
 *
 * IMPORTANTE: aquí NO se aplican las reglas de longitud/complejidad de la
 * contraseña (eso solo se hace en el registro, con CreateUserDto).
 *
 * Si en login se rechazara una contraseña que no cumple los requisitos
 * actuales, un atacante podría deducir cómo es la política de contraseñas
 * y, además, no podríamos validar usuarios cuyas contraseñas se crearon
 * con políticas más permisivas en el pasado.
 *
 * Cualquier credencial inválida (email mal formateado, contraseña vacía,
 * o credenciales incorrectas) responde con el mismo mensaje genérico
 * "Email o contraseña incorrectos" para evitar la enumeración de usuarios.
 */
export class LoginUserDto {
  @ApiProperty({ description: 'User email', nullable: false })
  @IsEmail({}, { message: 'Email o contraseña incorrectos' })
  email: string;

  @ApiProperty({ description: 'User password', nullable: false })
  @IsString({ message: 'Email o contraseña incorrectos' })
  clave: string;
}
