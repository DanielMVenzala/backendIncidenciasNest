import {
  BadRequestException,
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

      // Enviar email de activación
      await this.mailService.sendActivationEmail(
        newUser.email,
        newUser.nombre,
        activationToken,
      );

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
    const user = await this.userRepository.findOneBy({ activationToken: token });

    if (!user) {
      throw new BadRequestException('Token de activación inválido');
    }

    user.activo = true;
    user.activationToken = null;
    await this.userRepository.save(user);

    return { mensaje: 'Cuenta activada correctamente. Ya puedes iniciar sesión.' };
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
    if (!user) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
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
      creadoEn: user.creadoEn,
      actualizadoEn: user.actualizadoEn,
      incidentes: (user.incidentes || []).map((inc) => inc.id),
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.preload({
      //Le digo a typeorm que busque en la bdd por id y cargue
      //todas las propiedades que estén en ese updateUserDto
      id: id,
      ...updateUserDto,
    });

    if (!user) throw new NotFoundException(`Usuario con id ${id} no encontrado`);

    try {
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const user = await this.findOneUserEntity(id);
    await this.userRepository.remove(user);
  }

  async login(loginUserDto: LoginUserDto) {
    const { clave, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, clave: true, id: true, activo: true },
    });

    if (!user)
      throw new UnauthorizedException('Credenciales no válidas');

    if (!bcrypt.compareSync(clave, user.clave))
      throw new UnauthorizedException('Credenciales no válidas');

    if (!user.activo)
      throw new UnauthorizedException('Cuenta no activada. Revisa tu correo electrónico.');

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
    throw new InternalServerErrorException(
      'Error inesperado en el servidor',
    );
  }

  // Crear usuario ya activo (sin email) — usado por el seed
  async createActive(createUserDto: CreateUserDto) {
    try {
      const newUser = this.userRepository.create({
        ...createUserDto,
        activo: true,
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
