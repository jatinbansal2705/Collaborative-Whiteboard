export interface AppConfig {
  app: {
    env: 'development' | 'test' | 'production';
    host: string;
    port: number;
    logLevel: string;
    corsOrigins: string[];
    frontendUrl: string;
  };
  database: {
    url: string;
    redisUrl: string;
  };
  jwt: {
    accessSecret: string | undefined;
    accessExpiresIn: string;
    refreshSecret: string | undefined;
    refreshExpiresIn: string;
    emailSecret: string | undefined;
    emailExpiresIn: string;
    passwordResetSecret: string | undefined;
    passwordResetExpiresIn: string;
  };
  google: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    callbackUrl: string | undefined;
  };
  smtp: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  };
  cloudinary: {
    cloudName: string | undefined;
    apiKey: string | undefined;
    apiSecret: string | undefined;
  };
  throttle: {
    ttlMs: number;
    limit: number;
  };
  sentry: {
    dsn: string | undefined;
  };
}

const defaultCorsOrigins = ['http://localhost:3001'];

export default (): AppConfig => ({
  app: {
    env: parseNodeEnv(process.env.NODE_ENV),
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInt(process.env.PORT ?? '3000', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    emailSecret: process.env.JWT_EMAIL_SECRET,
    emailExpiresIn: process.env.JWT_EMAIL_EXPIRES_IN ?? '24h',
    passwordResetSecret: process.env.JWT_PASSWORD_RESET_SECRET,
    passwordResetExpiresIn: process.env.JWT_PASSWORD_RESET_EXPIRES_IN ?? '1h',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from:
      process.env.SMTP_FROM ??
      'Collaborative Whiteboard <no-reply@example.com>',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
});

function parseNodeEnv(value: string | undefined): AppConfig['app']['env'] {
  switch (value) {
    case 'test':
      return 'test';
    case 'production':
      return 'production';
    default:
      return 'development';
  }
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return defaultCorsOrigins;
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
