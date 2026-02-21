const { WALLET_STATUS, AUDIT_ACTION } = require('../constants/wallet');
const { generateAccountNumberCandidate } = require('../utils/accountNumber');
const ApiError = require('../utils/apiError');
const { findByUserId, findByAccountNumber, createWallet } = require('../repositories/walletRepository');
const { createAuditLog } = require('../repositories/auditLogRepository');
const { getWalletBalance } = require('../repositories/ledgerRepository');

const generateUniqueAccountNumber = async (tx) => {
  for (let i = 0; i < 10; i += 1) {
    const candidate = generateAccountNumberCandidate();
    const existing = await findByAccountNumber(candidate, tx);
    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'Unable to generate unique account number');
};

const createUserWallet = async ({ userId, ipAddress }) => {
  const existingWallet = await findByUserId(userId);
  if (existingWallet) {
    throw new ApiError(409, 'User already has a wallet');
  }

  const accountNumber = await generateUniqueAccountNumber();
  const wallet = await createWallet({
    userId,
    accountNumber,
    status: WALLET_STATUS.ACTIVE,
    isSystem: false,
  });

  await createAuditLog({
    action: AUDIT_ACTION.WALLET_CREATED,
    userId,
    walletId: wallet.id,
    success: true,
    ipAddress,
  });

  return wallet;
};

const getMyWallet = async (userId) => {
  const wallet = await findByUserId(userId);
  if (!wallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  return wallet;
};

const getMyBalance = async (userId) => {
  const wallet = await getMyWallet(userId);
  const balance = await getWalletBalance(wallet.id);

  return {
    walletId: wallet.id,
    accountNumber: wallet.accountNumber,
    balance: balance.toString(),
    currency: 'NGN',
  };
};

module.exports = {
  createUserWallet,
  getMyWallet,
  getMyBalance,
};
