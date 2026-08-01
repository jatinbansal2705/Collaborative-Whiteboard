process.env.AUTH_RATE_LIMIT ??= '1000';
process.env.AUTH_RATE_LIMIT_TTL_MS ??= '60000';
process.env.AUTH_FORGOT_RATE_LIMIT ??= '1000';
process.env.AUTH_RESEND_RATE_LIMIT ??= '1000';
process.env.GOOGLE_CLIENT_ID ??= 'e2e-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'e2e-google-client-secret';
process.env.GOOGLE_CALLBACK_URL ??=
  'http://localhost:3000/api/v1/auth/google/callback';
