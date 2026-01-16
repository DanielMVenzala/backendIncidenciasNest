import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { IncidentsService } from 'src/incidents/incidents.service';
import { IncidentsModule } from 'src/incidents/incidents.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [SeedController],
  providers: [SeedService],
  imports: [IncidentsModule, UsersModule],
})
export class SeedModule {}
