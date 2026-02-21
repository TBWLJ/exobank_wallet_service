const redisClient = require('../config/redis');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey) {
    return next(new ApiError(400, 'Idempotency-Key header is required'));
  }

  const userId = req.user?.id;
  if (!userId) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  const storageKey = `idem:${userId}:${idempotencyKey}`;
  req.idempotencyKey = idempotencyKey;

  const existing = await redisClient.get(storageKey);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.state === 'DONE') {
      return res.status(parsed.statusCode).json(parsed.response);
    }

    return next(new ApiError(409, 'Duplicate request is already processing'));
  }

  const acquired = await redisClient.set(
    storageKey,
    JSON.stringify({ state: 'PROCESSING' }),
    {
      NX: true,
      EX: env.idempotencyTtlSeconds,
    }
  );

  if (!acquired) {
    return next(new ApiError(409, 'Duplicate request is already processing'));
  }

  let responseBody = null;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', async () => {
    try {
      if (res.statusCode < 500 && responseBody !== null) {
        await redisClient.set(
          storageKey,
          JSON.stringify({
            state: 'DONE',
            statusCode: res.statusCode,
            response: responseBody,
          }),
          { EX: env.idempotencyTtlSeconds }
        );
      } else {
        await redisClient.del(storageKey);
      }
    } catch (error) {
      console.error('Failed to persist idempotency response:', error.message);
    }
  });

  return next();
};

module.exports = idempotencyMiddleware;
