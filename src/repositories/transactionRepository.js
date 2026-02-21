const prisma = require('../config/prisma');

const createTransaction = (data, tx = prisma) => tx.transaction.create({ data });

const updateTransaction = (id, data, tx = prisma) =>
  tx.transaction.update({
    where: { id },
    data,
  });

const findTransactionById = (id, tx = prisma) =>
  tx.transaction.findUnique({
    where: { id },
    include: {
      senderWallet: true,
      receiverWallet: true,
      originalTransaction: true,
      reversals: true,
    },
  });

const findTransactionByReference = (reference, tx = prisma) =>
  tx.transaction.findUnique({
    where: { reference },
    include: {
      senderWallet: true,
      receiverWallet: true,
    },
  });

module.exports = {
  createTransaction,
  updateTransaction,
  findTransactionById,
  findTransactionByReference,
};
