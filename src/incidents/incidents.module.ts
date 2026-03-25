import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { Incident } from './entities/incident.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentImage } from './entities/incident-image.entity';
import { IncidentComment } from './entities/incident-comment.entity';
import { User } from 'src/users/entities/user.entity';
import { FilesModule } from 'src/files/files.module';
import { UsersModule } from 'src/users/users.module';
import { ReportsModule } from 'src/reports/reports.module';
import { GeocodingService } from 'src/common/services/geocoding.service';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, GeocodingService],
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentImage, IncidentComment, User]),
    FilesModule,
    UsersModule,
    ReportsModule,
  ],
  exports: [IncidentsService, TypeOrmModule],
})
export class IncidentsModule {}
