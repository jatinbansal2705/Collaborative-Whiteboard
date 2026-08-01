export interface GoogleOAuthProfile {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}
