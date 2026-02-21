const prisma = require('../config/prisma');

const createManyLedgerEntries = (data, tx = prisma) => tx.ledgerEntry.createMany({ data });

const getWalletBalance = async (walletId, tx = prisma) => {
  const rows = await tx.$queryRaw`
    SELECT COALESCE(SUM(
      CASE
        WHEN "entryType" = 'CREDIT' THEN amount
        WHEN "entryType" = 'DEBIT' THEN -amount
        ELSE 0
      END
    ), 0) AS balance
    FROM ledger_entries
    WHERE "walletId" = ${walletId}::uuid
  `;

  return rows[0].balance;
};

module.exports = {
  createManyLedgerEntries,
  getWalletBalance,
};
