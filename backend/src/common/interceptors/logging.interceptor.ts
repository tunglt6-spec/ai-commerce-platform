import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedUser } from '../types/authenticated-user';

/** Structured request logging. Does not log request/response bodies (avoids secret leakage). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();
    const user = req.user as AuthenticatedUser | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              method,
              url,
              status: context.switchToHttp().getResponse().statusCode,
              ms,
              tenantId: user?.tenantId,
              userId: user?.userId,
            }),
          );
        },
      }),
    );
  }
}
