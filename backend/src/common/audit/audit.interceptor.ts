import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from '../types/authenticated-user';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Auto-records an audit entry for every successful mutating request
 * (actor, tenant, action, target, timestamp). Read requests are not audited.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const user = req.user as AuthenticatedUser | undefined;
    const controller = context.getClass().name.replace(/Controller$/, '').toLowerCase();

    return next.handle().pipe(
      tap((result: any) => {
        const entityId =
          (result && (result.id || result?.data?.id)) ??
          req.params?.id ??
          null;
        void this.audit.record({
          tenantId: user?.tenantId ?? null,
          userId: user?.userId ?? null,
          action: `${method} ${req.route?.path ?? req.url}`,
          entityType: controller,
          entityId: entityId ? String(entityId) : null,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
          userAgent: (req.headers['user-agent'] as string) || null,
        });
      }),
    );
  }
}
