import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IncidentImage } from '../entities/incident-image.entity';
import { User } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IncidentPriority } from '../entities/incident.entity';

//Enum extendido que acepta 'critica' desde el front
export enum InputPriority {
  CRITICA = 'critica',
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
}

//Cómo se puede recibir la info a la hora de crear un incidente
export class CreateIncidentDto {
  @ApiProperty({
    description: 'Incident title',
    nullable: false,
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  titulo: string;

  @ApiProperty({
    description: 'Incident description',
    nullable: false,
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  descripcion: string;

  @ApiProperty({
    description: 'Incident address',
    nullable: false,
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  direccion: string;

  @ApiProperty({
    description: 'Incident images',
    nullable: false,
  })
  @Transform(({ value }: { value: string | string[] }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsArray()
  @IsString({ each: true })
  imagenes: string[];

  @ApiProperty({
    description: 'Incident priority (critica se mapea a alta)',
    enum: InputPriority,
    default: InputPriority.MEDIA,
    required: false,
  })
  @IsOptional()
  @IsEnum(InputPriority)
  prioridad?: InputPriority;

  //Cuando se crea un incidente en postman se introduce un string(email) no un User
  @ApiProperty()
  @IsString()
  usuario: string;
}
