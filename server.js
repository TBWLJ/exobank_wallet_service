const app = require('./src/app');
const env = require('./src/config/env');
const prisma = require('./src/config/prisma');
const redisClient = require('./src/config/redis');

const start = async () => {
  // await redisClient.connect();

  const server = app.listen(env.port, () => {
    console.log(`Wallet service listening on port ${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      await redisClient.quit();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch(async (error) => {
  console.error('Failed to start wallet service:', error);
  await prisma.$disconnect();
  process.exit(1);
});
