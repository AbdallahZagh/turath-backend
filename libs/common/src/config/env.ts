import Joi from 'joi';

/** Variables every service needs. Apps extend this with their own keys. */
export const baseEnvSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),
  REFRESH_TTL_DAYS: Joi.number().integer().positive().default(30),
}).unknown(true);

export const gatewayEnvSchema = baseEnvSchema.keys({
  PORT: Joi.number().port().default(4000),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),
  COOKIE_SECURE: Joi.boolean().default(false),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  THROTTLE_TTL_SECONDS: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(120),
  CACHE_TTL_SECONDS: Joi.number().integer().positive().default(60),
  RPC_TIMEOUT_MS: Joi.number().integer().positive().default(5000),
});

export const identityEnvSchema = baseEnvSchema.keys({
  IDENTITY_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  IDENTITY_HEALTH_PORT: Joi.number().port().default(4001),
  OTP_TTL_SECONDS: Joi.number().integer().positive().default(300),
  OTP_MAX_ATTEMPTS: Joi.number().integer().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().integer().positive().default(60),
  RESET_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(600),
  OTP_DEV_ECHO: Joi.boolean().default(false),
});
