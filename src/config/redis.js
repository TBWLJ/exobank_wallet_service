// const { createClient } = require('redis');
// const env = require('./env');

// const redisClient = createClient({ url: env.redisUrl });

// redisClient.on('error', (err) => {
//   console.error('Redis error:', err.message);
// });

// module.exports = redisClient;
const { createClient } = require('redis');
const env = require('./env'); // or process.env.REDIS_URL

const redisClient = createClient({
  url: env.redisUrl,
  socket: {
    // no TLS for this DB
  },
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Redis connected');
  }
})();

module.exports = redisClient;
