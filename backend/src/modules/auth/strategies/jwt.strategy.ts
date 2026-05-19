import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../config/app-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: ({ header }) => {
        if (header?.kid) {
          return configService.jwtSecret;
        }
        return configService.jwtSecret;
      },
      issuer: 'authsystem-api',
      audience: 'authsystem-app',
    });
  }

  async validate(payload: any) {
    if (payload.mfaPending) {
      throw new UnauthorizedException('MFA verification required');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
