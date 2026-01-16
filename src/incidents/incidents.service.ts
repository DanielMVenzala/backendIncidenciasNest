import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Incident, IncidentPriority } from './entities/incident.entity';
import { DataSource, ILike, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { FindIncidentsQueryDto } from 'src/common/dtos/find-incidents-query.dto';
import { off } from 'process';
import { IncidentImage } from './entities/incident-image.entity';
import { User } from 'src/users/entities/user.entity';
import { CloudinaryService } from 'src/common/services/cloudinary-service';

@Injectable()
export class IncidentsService {
  //Para mostrar los errores de forma sencilla
  private readonly logger = new Logger('UsersService');
  //Inyectar el repositorio

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,

    @InjectRepository(IncidentImage)
    private readonly incidentImageRepository: Repository<IncidentImage>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createIncidentDto: CreateIncidentDto) {
    const { imagenes = [], usuario, ...incidentDetails } = createIncidentDto;

    try {
      const user = await this.userRepository.findOneBy({
        email: usuario,
      });
      if (!user) {
        throw new NotFoundException(`User with email ${usuario} not found`);
      }
      //Se devuelven todas las propiedades y de las imágenes solo se devuelve la url
      const newIncident = this.incidentRepository.create({
        ...incidentDetails,
        imagenes: imagenes.map((imagen) =>
          this.incidentImageRepository.create({ url: imagen }),
        ),
        usuario: user,
      });
      await this.incidentRepository.save(newIncident);
      return { ...newIncident, imagenes: imagenes, usuario: user.id };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.handleDBExceptions(error);
    }
  }

  async findAll(query: FindIncidentsQueryDto) {
    const incidents = await this.findAllEntities(query);
    return incidents.map((incident) => this.formatIncident(incident));
  }

  async findOne(id: string) {
    const incident = await this.findOneEntity(id);
    return this.formatIncident(incident);
  }

  private formatIncident(incident: Incident) {
    return {
      ...incident,
      imagenes: (incident.imagenes || []).map((img) => img.url),
      usuario: incident.usuario?.id,
    };
  }

  async update(id: string, updateIncidentDto: UpdateIncidentDto) {
    const { imagenes, usuario, ...toUpdate } = updateIncidentDto;

    const incident = await this.findOneEntity(id);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //Si el DTO contiene imágenes, reemplazamos las actuales
      if (imagenes) {
        //Borrar fotos antiguas de Cloudinary
        if (incident.imagenes && incident.imagenes.length > 0) {
          const deletePromises = incident.imagenes.map((img) => {
            const parts = img.url.split('/');
            const fileName = parts.pop()?.split('.')[0];
            const folder = parts.pop();
            return this.cloudinaryService.deleteImage(`${folder}/${fileName}`);
          });
          await Promise.all(deletePromises);
        }

        //Limpiar tabla intermedia en DB
        await queryRunner.manager.delete(IncidentImage, { incident: { id } });

        //Preparar las nuevas imágenes
        incident.imagenes = imagenes.map((url) =>
          this.incidentImageRepository.create({ url }),
        );
      }

      //Aplicar cambios al objeto incidente
      const updatedIncident = await queryRunner.manager.preload(Incident, {
        id,
        ...toUpdate,
        imagenes: incident.imagenes,
      });

      if (!updatedIncident)
        throw new NotFoundException(`Incidente #${id} no encontrado`);

      await queryRunner.manager.save(updatedIncident);
      await queryRunner.commitTransaction();

      return this.formatIncident(updatedIncident);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Error al actualizar: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }

  private async findOneEntity(id: string) {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['imagenes', 'usuario'],
    });

    if (!incident)
      throw new NotFoundException(`Incident with id ${id} not found`);

    return incident;
  }

  async findAllEntities(query: FindIncidentsQueryDto): Promise<Incident[]> {
    const {
      titulo,
      descripcion,
      direccion,
      search,
      estado,
      prioridad,
      orderBy = 'creadoEn',
      order = 'DESC',
      limit = 100,
      offset = 0,
    } = query;

    const queryBuilder = this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.imagenes', 'imagenes')
      .leftJoinAndSelect('incident.usuario', 'usuario');

    //Se analizan todos los supuestos y se ejecutan las consultas en postgresql
    if (search) {
      queryBuilder.andWhere(
        `(
          incident.titulo ILIKE :search OR
          incident.descripcion ILIKE :search OR
          incident.direccion ILIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    if (titulo) {
      queryBuilder.andWhere('incident.titulo ILIKE :titulo', {
        titulo: `%${titulo}%`,
      });
    }

    if (descripcion) {
      queryBuilder.andWhere('incident.descripcion ILIKE :descripcion', {
        descripcion: `%${descripcion}%`,
      });
    }

    if (direccion) {
      queryBuilder.andWhere('incident.direccion ILIKE :direccion', {
        direccion: `%${direccion}%`,
      });
    }

    if (estado) {
      queryBuilder.andWhere(`incident.estado =:estado`, { estado });
    }

    if (prioridad) {
      queryBuilder.andWhere(`incident.prioridad =:prioridad`, { prioridad });
    }

    //Sería como decir incident.creadoEn-actualizadoEn, ASC-DESC
    //Esto viene validado previamente por el dto
    //orderBy => creadoEn - actualizadoEn
    //order => ASC - DESC
    queryBuilder.orderBy(`incident.${orderBy}`, order);
    queryBuilder.take(limit);
    queryBuilder.skip(offset);

    return await queryBuilder.getMany();
  }

  // async remove(id: string) {
  //   const incident = await this.findOneEntity(id); // Obtenemos la entidad real
  //   await this.incidentRepository.remove(incident);
  // }

  async remove(id: string) {
    //Buscamos el incidente con sus imágenes antes de eliminarlo
    const incident = await this.findOneEntity(id);

    //Borrado físico en Cloudinary
    if (incident.imagenes && incident.imagenes.length > 0) {
      const deletePromises = incident.imagenes.map((img) => {
        const parts = img.url.split('/');
        const fileName = parts.pop()?.split('.')[0]; // Nombre sin .jpg
        const folder = parts.pop(); // Nombre de la carpeta
        return this.cloudinaryService.deleteImage(`${folder}/${fileName}`);
      });

      //Ejecutamos todos los borrados en paralelo
      await Promise.all(deletePromises);
    }

    //Borrado en Base de Datos
    await this.incidentRepository.remove(incident);

    return {
      message: `Incidente con ID ${id} y sus imágenes han sido eliminados.`,
    };
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
  async deleteAllIncidences() {
    const query = this.incidentRepository.createQueryBuilder('incident');

    try {
      return await query.delete().where({}).execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
}
