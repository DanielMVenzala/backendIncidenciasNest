import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Incident } from './incident.entity';
import { User } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'incident_comments' })
export class IncidentComment {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column('text')
  texto: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @ManyToOne(() => Incident, (incident) => incident.comentarios, {
    onDelete: 'CASCADE',
  })
  incidencia: Incident;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  autor: User;
}
