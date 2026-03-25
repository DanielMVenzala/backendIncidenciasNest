import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles = this.reflector.get<string | string[]>('rol', context.getHandler());

    const req = context.switchToHttp().getRequest();
    const user = req.user as User;

    if (!user) throw new BadRequestException('Usuario no encontrado');

    // Soportar tanto string ('admin') como array (['admin'])
    const roles = Array.isArray(validRoles) ? validRoles : [validRoles];
    if (roles.includes(user.rol)) {
      return true;
    }

    throw new ForbiddenException(
      'No tienes permisos para realizar esta acción',
    );
  }
}
