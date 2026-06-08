import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

import { FindUsersQueryDto } from 'src/common/dtos/find-users-query.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MailService } from 'src/common/services/mail.service';

@Injectable()
export class UsersService {
  //Para mostrar los errores de forma sencilla
  private readonly logger = new Logger('UsersService');

  //Inyectar el repositorio
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const activationToken = uuid();
      const newUser = this.userRepository.create({
        ...createUserDto,
        activo: false,
        activationToken,
      });
      await this.userRepository.save(newUser);

      // Enviar email de activación en segundo plano (no bloquea la respuesta)
      console.log(`[MAIL] Enviando email de activación a ${newUser.email}...`);
      this.mailService
        .sendActivationEmail(newUser.email, newUser.nombre, activationToken)
        .then(() => {
          console.log(`[MAIL] Email enviado correctamente a ${newUser.email}`);
        })
        .catch((err) => {
          console.error(
            `[MAIL] Error al enviar email a ${newUser.email}:`,
            err,
          );
        });

      return {
        id: newUser.id,
        nombre: newUser.nombre,
        email: newUser.email,
        mensaje: 'Se ha enviado un correo de activación a tu email',
      };
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async activateAccount(token: string) {
    const user = await this.userRepository.findOneBy({
      activationToken: token,
    });

    if (!user) {
      throw new BadRequestException('Token de activación inválido');
    }

    user.activo = true;
    user.activationToken = null;
    await this.userRepository.save(user);

    return {
      mensaje: 'Cuenta activada correctamente. Ya puedes iniciar sesión.',
    };
  }

  /**
   * Genera un token de reset y envía un email al usuario.
   * Por seguridad, devuelve el mismo mensaje aunque el email no exista.
   */
  async forgotPassword(email: string) {
    const user = await this.userRepository.findOneBy({
      email: email.toLowerCase().trim(),
    });

    // No revelar si el email existe o no (seguridad)
    if (!user) {
      return {
        mensaje:
          'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
      };
    }

    const resetToken = uuid();
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await this.userRepository.save(user);

    // Envío en segundo plano (no bloquea la respuesta)
    this.mailService
      .sendResetPasswordEmail(user.email, user.nombre, resetToken)
      .catch((err) =>
        console.error('[MAIL] Error al enviar email de reset:', err.message),
      );

    return {
      mensaje:
        'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  /**
   * Valida el token y actualiza la contraseña del usuario.
   * Lanza error si el token no existe o ha expirado.
   */
  async resetPassword(token: string, nuevaClave: string) {
    const user = await this.userRepository.findOneBy({ resetToken: token });

    if (!user) {
      throw new BadRequestException('Token de restablecimiento inválido');
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException(
        'El enlace ha caducado. Solicita uno nuevo.',
      );
    }

    // Hashear nueva contraseña manualmente (el hook BeforeUpdate también lo hace)
    user.clave = await bcrypt.hash(
      nuevaClave,
      +process.env.BCRYPT_SALT_ROUNDS!,
    );
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await this.userRepository.save(user);

    return {
      mensaje:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
    };
  }

  async findAll(query: FindUsersQueryDto) {
    const users = await this.findAllEntities(query);
    return users.map((user) => ({
      ...user,
      incidentes: (user.incidentes || []).map((inc) => inc.id),
    }));
  }

  async findOne(id: string) {
    const user = await this.findOneUserEntity(id);
    return this.formatUser(user);
  }

  private async findOneUserEntity(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['incidentes'],
    });
    if (!user)
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    return user;
  }

  async findAllEntities(query: FindUsersQueryDto): Promise<User[]> {
    const { limit = 100, offset = 0, nombre, email, rol } = query;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.incidentes', 'incidentes');

    if (email) {
      queryBuilder.andWhere(`user.email = :email`, { email });
    }

    if (nombre) {
      queryBuilder.andWhere('user.nombre ILIKE :nombre', {
        nombre: `%${nombre}%`,
      });
    }

    if (rol) {
      queryBuilder.andWhere(`user.rol = :rol`, { rol });
    }

    queryBuilder.take(limit);
    queryBuilder.skip(offset);

    return await queryBuilder.getMany();
  }

  private formatUser(user: User) {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      bloqueado: user.bloqueado,
      fotoPerfil: user.fotoPerfil,
      creadoEn: user.creadoEn,
      actualizadoEn: user.actualizadoEn,
      incidentes: (user.incidentes || []).map((inc) => inc.id),
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: User) {
    const isAdmin = currentUser.rol === 'admin';
    const isOwner = currentUser.id === id;

    // Solo admin o el propio usuario pueden modificar el perfil
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'No tienes permisos para modificar este perfil',
      );
    }

    // Solo el admin puede cambiar el rol
    if (updateUserDto.rol !== undefined && !isAdmin) {
      throw new ForbiddenException(
        'Solo un administrador puede cambiar el rol',
      );
    }

    const user = await this.userRepository.preload({
      //Le digo a typeorm que busque en la bdd por id y cargue
      //todas las propiedades que estén en ese updateUserDto
      id: id,
      ...updateUserDto,
    });

    if (!user)
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);

    try {
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async toggleBlock(id: string) {
    const user = await this.findOneUserEntity(id);
    user.bloqueado = !user.bloqueado;
    await this.userRepository.save(user);
    return {
      id: user.id,
      bloqueado: user.bloqueado,
      mensaje: user.bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado',
    };
  }

  async remove(id: string) {
    const user = await this.findOneUserEntity(id);
    await this.userRepository.remove(user);
  }

  async login(loginUserDto: LoginUserDto) {
    const { clave, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        email: true,
        clave: true,
        id: true,
        activo: true,
        bloqueado: true,
      },
    });

    // Mensaje genérico para evitar la enumeración de usuarios:
    // un atacante no debe poder distinguir entre "el email no existe"
    // y "la contraseña es incorrecta".
    if (!user)
      throw new UnauthorizedException('Email o contraseña incorrectos');

    if (!bcrypt.compareSync(clave, user.clave))
      throw new UnauthorizedException('Email o contraseña incorrectos');

    if (user.bloqueado)
      throw new UnauthorizedException(
        'El administrador ha bloqueado su cuenta. Por favor, contacte con el área responsable.',
      );

    if (!user.activo)
      throw new UnauthorizedException(
        'Cuenta no activada. Revisa tu correo electrónico.',
      );

    return {
      id: user.id,
      email: user.email,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  //Excepciones controladas
  private handleDBExceptions(error: any) {
    //A través de la consola vemos el número de error y lo tratamos
    //para que muestre un error más concreto
    if (error.code === '23505') throw new BadRequestException(error.detail);
    this.logger.error(error);
    throw new InternalServerErrorException('Error inesperado en el servidor');
  }

  // Crear usuario ya activo (sin email) — usado por el seed
  async createActive(createUserDto: CreateUserDto) {
    try {
      const newUser = this.userRepository.create({
        ...createUserDto,
        activo: true,
        bloqueado: false,
        activationToken: null,
      });
      await this.userRepository.save(newUser);
      return newUser;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  //Para llamar cuando se implementa el seed
  async deleteAllUsers() {
    const query = this.userRepository.createQueryBuilder('user');

    try {
      return await query.delete().where({}).execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
}
