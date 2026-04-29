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
import { IncidentComment } from './entities/incident-comment.entity';
import { User } from 'src/users/entities/user.entity';
import { CloudinaryService } from 'src/common/services/cloudinary-service';
import { GeocodingService } from 'src/common/services/geocoding.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class IncidentsService {
  //Para mostrar los errores de forma sencilla
  private readonly logger = new Logger('UsersService');

  //Inyectar los diferentes repositorios
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,

    @InjectRepository(IncidentImage)
    private readonly incidentImageRepository: Repository<IncidentImage>,

    @InjectRepository(IncidentComment)
    private readonly commentRepository: Repository<IncidentComment>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async create(createIncidentDto: CreateIncidentDto) {
    const { imagenes = [], usuario, prioridad, ...incidentDetails } = createIncidentDto;

    try {
      const user = await this.userRepository.findOneBy({
        email: usuario,
      });
      if (!user) {
        throw new NotFoundException(`Usuario con email ${usuario} no encontrado`);
      }
      // Geocodificar la dirección y verificar que pertenece a Martos
      const coords = await this.geocodingService.geocode(incidentDetails.direccion);

      if (!coords) {
        throw new BadRequestException(
          'La dirección no es válida o no pertenece a Martos. Introduce una dirección dentro del municipio.',
        );
      }

      //Se devuelven todas las propiedades y de las imágenes solo se devuelve la url
      const newIncident = this.incidentRepository.create({
        ...incidentDetails,
        prioridad: prioridad ?? IncidentPriority.MEDIA,
        latitud: coords.latitud,
        longitud: coords.longitud,
        imagenes: imagenes.map((imagen) =>
          this.incidentImageRepository.create({ url: imagen }),
        ),
        usuario: user,
      } as Partial<Incident>);
      await this.incidentRepository.save(newIncident);
      return { ...newIncident, imagenes: imagenes, usuario: user.id };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
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

  //Método para mostrar el incidente de una determinada manera
  private formatIncident(incident: Incident) {
    return {
      ...incident,
      imagenes: (incident.imagenes || []).map((img) => img.url),
      comentarios: (incident.comentarios || []).map((c) => ({
        id: c.id,
        texto: c.texto,
        creadoEn: c.creadoEn,
        autor: c.autor
          ? { id: c.autor.id, nombre: c.autor.nombre }
          : null,
      })),
      usuario: incident.usuario?.id,
    };
  }

  async update(id: string, updateIncidentDto: UpdateIncidentDto) {
    const { imagenes, usuario, prioridad, ...toUpdate } = updateIncidentDto;

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
        ...(prioridad && { prioridad }),
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
      relations: ['imagenes', 'usuario', 'comentarios', 'comentarios.autor'],
    });

    if (!incident)
      throw new NotFoundException(`Incidencia con id ${id} no encontrada`);

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
      desde,
      hasta,
      orderBy = 'creadoEn',
      order = 'DESC',
      limit = 100,
      offset = 0,
    } = query;

    const queryBuilder = this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.imagenes', 'imagenes')
      .leftJoinAndSelect('incident.usuario', 'usuario')
      .leftJoinAndSelect('incident.comentarios', 'comentarios')
      .leftJoinAndSelect('comentarios.autor', 'comentarioAutor');

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

    // Filtros por rango de fechas (informes)
    if (desde) {
      queryBuilder.andWhere('incident.creadoEn >= :desde', { desde });
    }
    if (hasta) {
      // Sumamos 1 día al "hasta" para incluir todo el día seleccionado
      const hastaDate = new Date(hasta);
      hastaDate.setDate(hastaDate.getDate() + 1);
      queryBuilder.andWhere('incident.creadoEn < :hasta', {
        hasta: hastaDate.toISOString(),
      });
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

    //Borrado en base de datos
    await this.incidentRepository.remove(incident);

    return {
      message: `Incidente con ID ${id} y sus imágenes han sido eliminados.`,
    };
  }

  // ─── Comentarios ─────────────────────────────────────────

  async addComment(incidentId: string, createCommentDto: CreateCommentDto) {
    const incident = await this.findOneEntity(incidentId);

    const user = await this.userRepository.findOneBy({
      email: createCommentDto.usuario,
    });
    if (!user) {
      throw new NotFoundException(
        `User with email ${createCommentDto.usuario} not found`,
      );
    }

    const comment = this.commentRepository.create({
      texto: createCommentDto.texto,
      incidencia: incident,
      autor: user,
    });

    await this.commentRepository.save(comment);

    return {
      id: comment.id,
      texto: comment.texto,
      creadoEn: comment.creadoEn,
      autor: { id: user.id, nombre: user.nombre },
    };
  }

  async getComments(incidentId: string) {
    // Verificar que la incidencia existe
    await this.findOneEntity(incidentId);

    const comments = await this.commentRepository.find({
      where: { incidencia: { id: incidentId } },
      relations: ['autor'],
      order: { creadoEn: 'ASC' },
    });

    return comments.map((c) => ({
      id: c.id,
      texto: c.texto,
      creadoEn: c.creadoEn,
      autor: c.autor ? { id: c.autor.id, nombre: c.autor.nombre } : null,
    }));
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
