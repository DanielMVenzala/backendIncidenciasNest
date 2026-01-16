import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { CloudinaryService } from 'src/common/services/cloudinary-service';
import { CloudinaryProvider } from 'src/common/providers/cloudinary.provider';

@Module({
  controllers: [FilesController],
  providers: [FilesService, CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService],
})
export class FilesModule {}
