import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  JWT_ACCESS_STRATEGY,
} from '../constants/auth.constants';
import { JwtPayload } from '../types/jwt-payload.type';
type CookieRequest = {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_STRATEGY,
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: CookieRequest) =>
          request.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService
      .getUserById(payload.sub)
      .catch(() => undefined);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Your account is deactivated.');
    }

    return payload;
  }
}
