import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from './helpers/fileFilter';
import { CloudinaryService } from 'src/common/services/cloudinary-service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Images')
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('incident')
  //Interceptor que intercepta las solicitudes y las respuestas
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: fileFilter,
    }),
  )
  //Método que llama al upload del servicio de Cloudinary
  async uploadIncidentImage(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('Asegúrate de que el archivo sea una imagen');

    const result = await this.cloudinaryService.uploadImage(file);
    return {
      url: result.secure_url,
    };
  }
}
