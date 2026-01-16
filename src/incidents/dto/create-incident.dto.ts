import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { IncidentImage } from '../entities/incident-image.entity';
import { User } from 'src/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsArray()
  @IsString({ each: true })
  imagenes: string[];

  //Cuando se crea un incidente en postman se introduce un string(email) no un User
  @ApiProperty()
  @IsString()
  usuario: string;
}
