// testPrisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wallets = await prisma.Wallet.findMany();
  console.log(wallets);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());