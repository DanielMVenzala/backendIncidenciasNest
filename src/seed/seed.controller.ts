import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SeedService } from './seed.service';
import { RoleProtected } from 'src/users/decorators/role-protected/role-protected.decorator';
import { ValidRoles } from 'src/users/interfaces/valid-roles';
import { UserRoleGuard } from 'src/users/guards/user-role/user-role.guard';

/**
 * Controlador del seed (datos de prueba).
 * PROTEGIDO: solo un administrador autenticado puede ejecutar el seed.
 * En producción, ejecutar este endpoint borra TODA la base de datos
 * y la rellena con datos de prueba.
 */
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  // TODO: Volver a proteger con guards tras ejecutar el seed
  @Get()
  executeSeed() {
    return this.seedService.runSeed();
  }
}
