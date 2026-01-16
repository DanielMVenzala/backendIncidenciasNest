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
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class UsersService {
  //Para mostrar los errores de forma sencilla
  private readonly logger = new Logger('UsersService');

  //Inyectar el repositorio
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const newUser = this.userRepository.create(createUserDto);
      await this.userRepository.save(newUser);

      return {
        ...newUser,
        token: this.getJwtToken({ id: newUser.id }),
      };
    } catch (error) {
      this.handleDBExceptions(error);
    }
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
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
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

    if (!user) throw new NotFoundException(`User with id ${id} not found`);

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
      select: { email: true, clave: true, id: true },
    });

    if (!user)
      throw new UnauthorizedException('Crendentials are not valid (email)');

    if (!bcrypt.compareSync(clave, user.clave))
      throw new UnauthorizedException('Crendentials are not valid (password)');

    return {
      ...user,
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
      'Unexpected error, check server logs',
    );
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
