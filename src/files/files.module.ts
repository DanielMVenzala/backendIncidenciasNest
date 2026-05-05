import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { CloudinaryService } from 'src/common/services/cloudinary-service';
import { CloudinaryProvider } from 'src/common/providers/cloudinary.provider';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [FilesController],
  providers: [FilesService, CloudinaryService, CloudinaryProvider],
  imports: [UsersModule],
  exports: [CloudinaryService],
})
export class FilesModule {}
