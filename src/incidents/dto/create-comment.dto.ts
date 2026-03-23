import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Texto del comentario', minLength: 1 })
  @IsString()
  @MinLength(1)
  texto: string;

  @ApiProperty({ description: 'Email del autor del comentario' })
  @IsString()
  usuario: string;
}
