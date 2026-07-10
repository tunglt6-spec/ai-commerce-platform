import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles';

export const ROLES_KEY = 'roles';
/** Require the caller to have at least one of the given tenant roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
