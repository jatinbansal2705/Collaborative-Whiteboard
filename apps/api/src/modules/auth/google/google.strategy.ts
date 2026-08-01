import { ConfigService } from '@nestjs/config';
import passport from 'passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import type { GoogleOAuthProfile } from './google-oauth.types';

export function registerGoogleStrategy(configService: ConfigService): void {
  const clientId = configService.get<string>('google.clientId');
  const clientSecret = configService.get<string>('google.clientSecret');
  const callbackURL = configService.get<string>('google.callbackUrl');
  if (
    clientId === undefined ||
    clientSecret === undefined ||
    callbackURL === undefined
  ) {
    return;
  }

  passport.use(
    'google',
    new Strategy(
      {
        clientID: clientId,
        clientSecret,
        callbackURL,
        scope: ['email', 'profile'],
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: GoogleOAuthProfile) => void,
      ) => {
        const email = profile.emails?.[0]?.value;
        if (email === undefined) {
          done(new Error('Google profile did not include an email'));
          return;
        }
        done(null, {
          googleId: profile.id,
          email,
          name: profile.displayName || undefined,
          avatarUrl: profile.photos?.[0]?.value,
          emailVerified: profile.emails?.[0]?.verified === true,
        });
      },
    ),
  );
}
