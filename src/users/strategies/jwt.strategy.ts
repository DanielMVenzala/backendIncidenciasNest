import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Estrategia JWT para Passport.
 * Se ejecuta automáticamente en cada petición protegida con @UseGuards(AuthGuard()).
 * Extrae el token del header Authorization: Bearer <token>, lo decodifica
 * con la clave secreta y busca al usuario en la base de datos.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get('JWT_SECRET')!,
      // Extraer el JWT del header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  /**
   * Se ejecuta tras decodificar el JWT. Verifica que el usuario existe
   * y está activo. Si es válido, inyecta el usuario en req.user.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const { id } = payload;

    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new UnauthorizedException('Token no válido');

    if (!user.activo)
      throw new UnauthorizedException(
        'Usuario inactivo, contacta con un administrador',
      );

    // El usuario queda disponible en req.user para los guards y controladores
    return user;
  }
}
