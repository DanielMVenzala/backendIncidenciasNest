import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Texto del comentario', minLength: 1 })
  @IsString({ message: 'El comentario debe ser un texto' })
  @MinLength(1, { message: 'El comentario no puede estar vacío' })
  texto: string;

  @ApiProperty({ description: 'Email del autor del comentario' })
  @IsString({ message: 'El usuario debe ser un texto' })
  usuario: string;
}
