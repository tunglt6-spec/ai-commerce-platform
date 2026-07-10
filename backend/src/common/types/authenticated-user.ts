import { Role } from '../constants/roles';

/** The authenticated principal attached to every request by JwtAuthGuard. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
  /** True when the platform-level user.role === 'admin' (super admin). */
  isPlatformAdmin: boolean;
}
