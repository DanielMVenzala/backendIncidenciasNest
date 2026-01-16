import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { Incident } from './entities/incident.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentImage } from './entities/incident-image.entity';
import { User } from 'src/users/entities/user.entity';
import { FilesModule } from 'src/files/files.module';
import { UsersModule } from 'src/users/users.module';
import { ReportsModule } from 'src/reports/reports.module';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService],
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentImage, User]),
    FilesModule,
    UsersModule,
    ReportsModule,
  ],
  exports: [IncidentsService, TypeOrmModule],
})
export class IncidentsModule {}
