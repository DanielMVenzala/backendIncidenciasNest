import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentImage } from './incident-image.entity';
import { IncidentComment } from './incident-comment.entity';
import { User } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum IncidentState {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en progreso',
  RESUELTO = 'resuelto',
  RECHAZADA = 'rechazada',
}

export enum IncidentPriority {
  CRITICA = 'critica',
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
}

//Construcción de la bdd de incidentes en postgres
@Entity({ name: 'incidents' })
export class Incident {
  @ApiProperty({
    example: '61cbf5a2-b7c4-47bd-a14d-22067acb27bd',
    description: 'Incident ID',
    uniqueItems: true,
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Rotura de tubería riego',
    description: 'Incident title',
  })
  @Column('text')
  titulo: string;

  @ApiProperty({
    example: 'La tubería del sistema de riego pierde agua continuamente.',
    description: 'Incident description',
  })
  @Column('text')
  descripcion: string;

  @ApiProperty({
    example: 'Parque del Lagartijo, Martos',
    description: 'Incident address',
  })
  @Column('text')
  direccion: string;

  @ApiProperty({
    example: 'Pendiente',
    description: 'Incident state',
  })
  @Column({
    type: 'enum',
    enum: IncidentState,
    default: IncidentState.PENDIENTE,
  })
  estado: IncidentState;

  @ApiProperty({
    example: 'Media',
    description: 'Incident priority',
  })
  @Column({
    type: 'enum',
    enum: IncidentPriority,
    default: IncidentPriority.MEDIA,
  })
  prioridad: IncidentPriority;

  @ApiProperty({ example: 37.7241, description: 'Latitud de la incidencia' })
  @Column('float', { nullable: true })
  latitud: number;

  @ApiProperty({ example: -3.9717, description: 'Longitud de la incidencia' })
  @Column('float', { nullable: true })
  longitud: number;

  @ApiProperty()
  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  creadoEn: Date;

  @ApiProperty()
  @UpdateDateColumn({
    type: 'timestamp with time zone',
  })
  actualizadoEn: Date;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/dr7k013n5/image/upload/v1767882538/martos_incidents/file_rnsdpr.jpg',
    description: 'Incident images',
  })
  @OneToMany(() => IncidentImage, (incidentImage) => incidentImage.incident, {
    cascade: true,
    eager: true,
  })
  //IncidentImagen es: { id: string; url: string; incidentId: Incident }
  imagenes: IncidentImage[];

  @OneToMany(() => IncidentComment, (comment) => comment.incidencia, {
    cascade: true,
    eager: true,
  })
  comentarios: IncidentComment[];

  //La nueva columna que se crea es de tipo User
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.incidentes, {
    eager: true,
    onDelete: 'SET NULL',
  })
  usuario: User;
}
