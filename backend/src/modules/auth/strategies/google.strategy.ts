import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AppConfigService } from '../../../config/app-config.service';

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  providerId: string;
  picture?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: AppConfigService) {
    super({
      clientID: configService.googleClientId,
      clientSecret: configService.googleClientSecret,
      callbackURL: configService.googleCallbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): void {
    const { name, emails, id, photos } = profile;
    if (!emails || emails.length === 0) {
      done(new UnauthorizedException('Google account has no email'), false);
      return;
    }

    const googleProfile: GoogleProfile = {
      email: emails[0].value,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      providerId: id,
      picture: photos?.[0]?.value,
    };

    done(null, googleProfile);
  }
}
