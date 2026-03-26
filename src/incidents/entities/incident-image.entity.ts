import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Incident } from './incident.entity';

// Entidad que almacena las URLs de las imágenes subidas a Cloudinary.
// Cada incidencia puede tener múltiples imágenes (relación OneToMany).
@Entity({ name: 'incident_images' })
export class IncidentImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  url: string;

  @ManyToOne(() => Incident, (incident) => incident.imagenes, {
    onDelete: 'CASCADE',
  })
  incident: Incident;
}
