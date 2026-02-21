const redisClient = require('../config/redis');
const env = require('../config/env');

const transferRateLimitMiddleware = async (req, res, next) => {
  const identifier = req.user?.id || req.ip;
  const key = `wallet_transfer_rate:${identifier}`;

  const attempts = await redisClient.incr(key);
  if (attempts === 1) {
    await redisClient.expire(key, env.transferRateLimitWindowSeconds);
  }

  if (attempts > env.transferRateLimitMaxAttempts) {
    return res.status(429).json({
      message: 'Transfer rate limit exceeded. Try again later.',
    });
  }

  return next();
};

module.exports = transferRateLimitMiddleware;
