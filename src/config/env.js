const dotenv = require('dotenv');

dotenv.config();

const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = {
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  nibssSimulatorUrl: process.env.NIBSS_SIMULATOR_URL || null,
  nibssApiKey: process.env.NIBSS_API_KEY || null,
  nibssWebhookSecret: process.env.NIBSS_WEBHOOK_SECRET || null,
  settlementAccountNumber: process.env.SETTLEMENT_ACCOUNT_NUMBER || '3999999999',
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
  transferRateLimitWindowSeconds: Number(process.env.TRANSFER_RATE_LIMIT_WINDOW_SECONDS || 60),
  transferRateLimitMaxAttempts: Number(process.env.TRANSFER_RATE_LIMIT_MAX_ATTEMPTS || 10),
};
