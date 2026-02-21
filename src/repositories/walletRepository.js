const prisma = require('../config/prisma');

const findByUserId = (userId, tx = prisma) => tx.wallet.findUnique({ where: { userId } });

const findById = (id, tx = prisma) => tx.wallet.findUnique({ where: { id } });

const findByAccountNumber = (accountNumber, tx = prisma) =>
  tx.wallet.findUnique({ where: { accountNumber } });

const createWallet = (data, tx = prisma) => tx.wallet.create({ data });

module.exports = {
  findByUserId,
  findById,
  findByAccountNumber,
  createWallet,
};
