import { SetMetadata } from '@nestjs/common';
import { ValidRoles } from 'src/users/interfaces/valid-roles';

export const META_ROLES = 'rol';

export const RoleProtected = (...args: ValidRoles[]) => {
  return SetMetadata(META_ROLES, args);
};
