import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IncidentImage } from '../entities/incident-image.entity';
import { User } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IncidentPriority } from '../entities/incident.entity';

//Cómo se puede recibir la info a la hora de crear un incidente
export class CreateIncidentDto {
  @ApiProperty({
    description: 'Incident title',
    nullable: false,
    minLength: 10,
  })
  @IsString({ message: 'El título debe ser un texto' })
  @MinLength(10, { message: 'El título debe tener al menos 10 caracteres' })
  titulo: string;

  @ApiProperty({
    description: 'Incident description',
    nullable: false,
    minLength: 10,
  })
  @IsString({ message: 'La descripción debe ser un texto' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  descripcion: string;

  @ApiProperty({
    description: 'Incident address',
    nullable: false,
    minLength: 10,
  })
  @IsString({ message: 'La dirección debe ser un texto' })
  @MinLength(10, { message: 'La dirección debe tener al menos 10 caracteres' })
  direccion: string;

  @ApiProperty({
    description: 'Incident images',
    nullable: false,
  })
  @Transform(({ value }: { value: string | string[] }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsArray({ message: 'Las imágenes deben ser una lista' })
  @IsString({ each: true, message: 'Cada imagen debe ser un texto' })
  imagenes: string[];

  @ApiProperty({
    description: 'Incident priority',
    enum: IncidentPriority,
    default: IncidentPriority.MEDIA,
    required: false,
  })
  @IsOptional()
  @IsEnum(IncidentPriority, { message: 'La prioridad no es válida' })
  prioridad?: IncidentPriority;

  //Cuando se crea un incidente en postman se introduce un string(email) no un User
  @ApiProperty()
  @IsString({ message: 'El usuario debe ser un texto' })
  usuario: string;
}
