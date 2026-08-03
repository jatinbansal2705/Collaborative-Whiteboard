import * as Joi from 'joi';

const optionalString = Joi.string().empty('');

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().empty('').default('0.0.0.0'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
    .default('info'),
  CORS_ORIGINS: Joi.string().empty('').default('http://localhost:3001'),
  FRONTEND_URL: Joi.string().uri().empty('').default('http://localhost:3001'),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().empty('').default('redis://localhost:6379'),

  REALTIME_PRESENCE_TTL_MS: Joi.number().integer().positive().default(90000),
  REALTIME_CURSOR_MIN_INTERVAL_MS: Joi.number()
    .integer()
    .positive()
    .default(25),
  REALTIME_CHAT_TYPING_THROTTLE_MS: Joi.number()
    .integer()
    .positive()
    .default(1000),

  EMAIL_QUEUE_NAME: Joi.string().empty('').default('email'),
  EMAIL_QUEUE_ATTEMPTS: Joi.number().integer().positive().default(3),
  EMAIL_QUEUE_BACKOFF_MS: Joi.number().integer().positive().default(5000),

  JWT_ACCESS_SECRET: Joi.string().min(16).empty('').optional(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().empty('').default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).empty('').optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().empty('').default('30d'),
  JWT_ISSUER: Joi.string().empty('').default('collaborative-whiteboard'),
  JWT_AUDIENCE: Joi.string().empty('').default('whiteboard-api'),
  JWT_EMAIL_SECRET: Joi.string().min(16).empty('').optional(),
  JWT_EMAIL_EXPIRES_IN: Joi.string().empty('').default('24h'),
  JWT_PASSWORD_RESET_SECRET: Joi.string().min(16).empty('').optional(),
  JWT_PASSWORD_RESET_EXPIRES_IN: Joi.string().empty('').default('1h'),
  JWT_OAUTH_HANDOFF_SECRET: Joi.string().min(16).empty('').optional(),
  JWT_OAUTH_HANDOFF_EXPIRES_IN: Joi.string().empty('').default('5m'),

  GOOGLE_CLIENT_ID: optionalString.optional(),
  GOOGLE_CLIENT_SECRET: optionalString.optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().empty('').optional(),

  SMTP_HOST: optionalString.optional(),
  SMTP_PORT: Joi.number().port().empty('').default(587),
  SMTP_SECURE: Joi.boolean().empty('').default(false),
  SMTP_USER: optionalString.optional(),
  SMTP_PASS: optionalString.optional(),
  SMTP_FROM: optionalString.default(
    'Collaborative Whiteboard <no-reply@example.com>',
  ),

  CLOUDINARY_CLOUD_NAME: optionalString.optional(),
  CLOUDINARY_API_KEY: optionalString.optional(),
  CLOUDINARY_API_SECRET: optionalString.optional(),

  THROTTLE_TTL_MS: Joi.number().integer().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),

  SENTRY_DSN: Joi.string().uri().empty('').optional(),
}).unknown();
