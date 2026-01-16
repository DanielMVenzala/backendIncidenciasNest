import { Injectable } from '@nestjs/common';
import { IncidentsService } from 'src/incidents/incidents.service';
import { initialData } from './data/seed-data';

import { CreateIncidentDto } from 'src/incidents/dto/create-incident.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class SeedService {
  constructor(
    private readonly incidentService: IncidentsService,
    private readonly userService: UsersService,
  ) {}
  async runSeed() {
    await this.insertIncidentsAndUsers();
    return `Seed executed`;
  }

  private async insertIncidentsAndUsers() {
    await this.incidentService.deleteAllIncidences();
    await this.userService.deleteAllUsers();

    const seedUsers = initialData.users;
    const seedIncidents = initialData.incidents;

    const userPromises: Promise<any>[] = [];
    for (const user of seedUsers) {
      userPromises.push(this.userService.create(user));
    }
    await Promise.all(userPromises);

    const incidentPromises: Promise<any>[] = [];
    for (const incident of seedIncidents) {
      incidentPromises.push(
        this.incidentService.create(incident as CreateIncidentDto),
      );
    }

    await Promise.all(incidentPromises);

    return true;
  }
}
