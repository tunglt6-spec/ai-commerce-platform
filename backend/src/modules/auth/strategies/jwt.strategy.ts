import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { isRole } from '../../../common/constants/roles';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
  isPlatformAdmin: boolean;
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access' || !payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token');
    }
    if (!isRole(payload.role)) {
      throw new UnauthorizedException('Invalid role in token');
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
      isPlatformAdmin: !!payload.isPlatformAdmin,
    };
  }
}
