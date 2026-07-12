import { Injectable, NestMiddleware } from '@nestjs/common';
import { runWithTenantContext } from './tenant-context';

/**
 * Establishes a fresh tenant context for each request BEFORE guards run, so the JWT
 * strategy can populate it and the Prisma tenant guard can read it for the whole
 * request lifecycle. Calling next() inside the AsyncLocalStorage run propagates the
 * context through guards, interceptors, and the route handler.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void): void {
    runWithTenantContext(() => next());
  }
}
