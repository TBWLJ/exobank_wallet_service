const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');
const env = require('../config/env');
const {
  WALLET_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  LEDGER_ENTRY_TYPE,
  AUDIT_ACTION,
} = require('../constants/wallet');
const ApiError = require('../utils/apiError');
const { toAmountDecimal } = require('../utils/money');
const { generateReference } = require('../utils/reference');
const { assertTransition } = require('../utils/transactionState');
const { notifyExternalTransfer } = require('../utils/nibssClient');
const {
  findByUserId,
  findById,
  findByAccountNumber,
  createWallet,
} = require('../repositories/walletRepository');
const {
  createTransaction,
  updateTransaction,
  findTransactionById,
  findTransactionByReference,
} = require('../repositories/transactionRepository');
const { createManyLedgerEntries, getWalletBalance } = require('../repositories/ledgerRepository');
const { createAuditLog } = require('../repositories/auditLogRepository');

const lockWallet = async (walletId, tx) => {
  await tx.$executeRaw`
    SELECT id FROM wallets WHERE id = ${walletId}::uuid FOR UPDATE
  `;
};

const lockTransaction = async (transactionId, tx) => {
  await tx.$executeRaw`
    SELECT id FROM transactions WHERE id = ${transactionId}::uuid FOR UPDATE
  `;
};

const ensureSettlementWallet = async (tx) => {
  const existing = await findByAccountNumber(env.settlementAccountNumber, tx);
  if (existing) {
    return existing;
  }

  return createWallet(
    {
      userId: null,
      accountNumber: env.settlementAccountNumber,
      status: WALLET_STATUS.ACTIVE,
      isSystem: true,
    },
    tx
  );
};

const requireActiveUserWallet = async (userId, tx) => {
  const wallet = await findByUserId(userId, tx);
  if (!wallet) {
    throw new ApiError(404, 'Sender wallet not found');
  }

  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw new ApiError(403, 'Sender wallet is not active');
  }

  return wallet;
};

const assertSufficientBalance = async (walletId, amount, tx) => {
  const rawBalance = await getWalletBalance(walletId, tx);
  const balance = new Prisma.Decimal(rawBalance || 0);

  if (balance.lt(amount)) {
    throw new ApiError(409, 'Insufficient balance');
  }
};

const logAudit = ({ action, userId = null, walletId = null, success, ipAddress, metadata = null }, tx) =>
  createAuditLog(
    {
      action,
      userId,
      walletId,
      success,
      ipAddress,
      metadata,
    },
    tx
  );

const transitionStatus = async (transaction, nextStatus, tx) => {
  assertTransition(transaction.status, nextStatus);

  return updateTransaction(
    transaction.id,
    {
      status: nextStatus,
    },
    tx
  );
};

const internalTransfer = async ({ userId, receiverAccountNumber, amount, currency = 'NGN', idempotencyKey, ipAddress }) => {
  const amountDecimal = toAmountDecimal(amount);

  return prisma.$transaction(async (tx) => {
    const senderWallet = await requireActiveUserWallet(userId, tx);
    const receiverWallet = await findByAccountNumber(receiverAccountNumber, tx);

    if (!receiverWallet) {
      throw new ApiError(404, 'Receiver wallet not found');
    }

    if (receiverWallet.status !== WALLET_STATUS.ACTIVE) {
      throw new ApiError(403, 'Receiver wallet is not active');
    }

    if (receiverWallet.id === senderWallet.id) {
      throw new ApiError(400, 'Cannot transfer to same wallet');
    }

    const lockIds = [senderWallet.id, receiverWallet.id].sort();
    await lockWallet(lockIds[0], tx);
    await lockWallet(lockIds[1], tx);

    await assertSufficientBalance(senderWallet.id, amountDecimal, tx);

    const reference = generateReference('ITR');

    let transaction = await createTransaction(
      {
        reference,
        type: TRANSACTION_TYPE.INTERNAL,
        amount: amountDecimal,
        currency,
        status: TRANSACTION_STATUS.INITIATED,
        senderWalletId: senderWallet.id,
        receiverWalletId: receiverWallet.id,
        idempotencyKey,
      },
      tx
    );

    await logAudit(
      {
        action: AUDIT_ACTION.TRANSFER_INITIATED,
        userId,
        walletId: senderWallet.id,
        success: true,
        ipAddress,
        metadata: { transactionId: transaction.id, reference, type: 'INTERNAL' },
      },
      tx
    );

    transaction = await transitionStatus(transaction, TRANSACTION_STATUS.PENDING, tx);

    await createManyLedgerEntries(
      [
        {
          transactionId: transaction.id,
          walletId: senderWallet.id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amount: amountDecimal,
        },
        {
          transactionId: transaction.id,
          walletId: receiverWallet.id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amount: amountDecimal,
        },
      ],
      tx
    );

    transaction = await transitionStatus(transaction, TRANSACTION_STATUS.SUCCESS, tx);

    await logAudit(
      {
        action: AUDIT_ACTION.TRANSFER_SUCCESS,
        userId,
        walletId: senderWallet.id,
        success: true,
        ipAddress,
        metadata: { transactionId: transaction.id, reference, type: 'INTERNAL' },
      },
      tx
    );

    return {
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      type: transaction.type,
    };
  });
};

const externalTransfer = async ({
  userId,
  amount,
  currency = 'NGN',
  externalBankCode,
  externalAccountNumber,
  idempotencyKey,
  ipAddress,
}) => {
  const amountDecimal = toAmountDecimal(amount);

  const transferData = await prisma.$transaction(async (tx) => {
    const senderWallet = await requireActiveUserWallet(userId, tx);
    const settlementWallet = await ensureSettlementWallet(tx);

    await lockWallet(senderWallet.id, tx);
    await lockWallet(settlementWallet.id, tx);

    await assertSufficientBalance(senderWallet.id, amountDecimal, tx);

    const reference = generateReference('ETR');

    let transaction = await createTransaction(
      {
        reference,
        type: TRANSACTION_TYPE.EXTERNAL,
        amount: amountDecimal,
        currency,
        status: TRANSACTION_STATUS.INITIATED,
        senderWalletId: senderWallet.id,
        receiverWalletId: null,
        externalBankCode,
        externalAccountNumber,
        idempotencyKey,
      },
      tx
    );

    await logAudit(
      {
        action: AUDIT_ACTION.TRANSFER_INITIATED,
        userId,
        walletId: senderWallet.id,
        success: true,
        ipAddress,
        metadata: { transactionId: transaction.id, reference, type: 'EXTERNAL' },
      },
      tx
    );

    transaction = await transitionStatus(transaction, TRANSACTION_STATUS.PENDING, tx);

    await createManyLedgerEntries(
      [
        {
          transactionId: transaction.id,
          walletId: senderWallet.id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amount: amountDecimal,
        },
        {
          transactionId: transaction.id,
          walletId: settlementWallet.id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amount: amountDecimal,
        },
      ],
      tx
    );

    return {
      id: transaction.id,
      reference: transaction.reference,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      senderWalletId: senderWallet.id,
      userId,
    };
  });

  try {
    const nibssResponse = await notifyExternalTransfer({
      reference: transferData.reference,
      amount: transferData.amount.toString(),
      currency: transferData.currency,
      externalBankCode,
      externalAccountNumber,
    });

    if (nibssResponse?.status === 'SUCCESS' || nibssResponse?.status === 'FAILED') {
      await handleNibssWebhook({
        reference: transferData.reference,
        status: nibssResponse.status,
        ipAddress,
        metadata: { source: 'sync_response' },
      });
    }
  } catch (error) {
    await logAudit({
      action: AUDIT_ACTION.TRANSFER_FAILED,
      userId,
      walletId: transferData.senderWalletId,
      success: false,
      ipAddress,
      metadata: {
        reason: 'nibss_call_failed',
        reference: transferData.reference,
        error: error.message,
      },
    });
  }

  return {
    transactionId: transferData.id,
    reference: transferData.reference,
    status: transferData.status,
    amount: transferData.amount.toString(),
    currency: transferData.currency,
    type: TRANSACTION_TYPE.EXTERNAL,
  };
};

const handleNibssWebhook = async ({ reference, status, ipAddress, metadata = null }) => {
  return prisma.$transaction(async (tx) => {
    const transaction = await findTransactionByReference(reference, tx);

    if (!transaction || transaction.type !== TRANSACTION_TYPE.EXTERNAL) {
      throw new ApiError(404, 'External transaction not found');
    }

    await lockTransaction(transaction.id, tx);

    const current = await findTransactionByReference(reference, tx);

    if (current.status !== TRANSACTION_STATUS.PENDING) {
      return {
        reference: current.reference,
        status: current.status,
        message: 'Transaction already finalized',
      };
    }

    const settlementWallet = await ensureSettlementWallet(tx);

    await logAudit(
      {
        action: AUDIT_ACTION.EXTERNAL_WEBHOOK_RECEIVED,
        userId: current.senderWallet.userId,
        walletId: current.senderWalletId,
        success: true,
        ipAddress,
        metadata: {
          reference,
          webhookStatus: status,
          ...(metadata || {}),
        },
      },
      tx
    );

    if (status === 'SUCCESS') {
      const updated = await transitionStatus(current, TRANSACTION_STATUS.SUCCESS, tx);

      await logAudit(
        {
          action: AUDIT_ACTION.TRANSFER_SUCCESS,
          userId: current.senderWallet.userId,
          walletId: current.senderWalletId,
          success: true,
          ipAddress,
          metadata: { transactionId: current.id, reference },
        },
        tx
      );

      return {
        reference: updated.reference,
        status: updated.status,
      };
    }

    const failed = await transitionStatus(current, TRANSACTION_STATUS.FAILED, tx);

    await lockWallet(current.senderWalletId, tx);
    await lockWallet(settlementWallet.id, tx);

    await createManyLedgerEntries(
      [
        {
          transactionId: current.id,
          walletId: settlementWallet.id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amount: current.amount,
        },
        {
          transactionId: current.id,
          walletId: current.senderWalletId,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amount: current.amount,
        },
      ],
      tx
    );

    await logAudit(
      {
        action: AUDIT_ACTION.TRANSFER_FAILED,
        userId: current.senderWallet.userId,
        walletId: current.senderWalletId,
        success: false,
        ipAddress,
        metadata: { transactionId: current.id, reference },
      },
      tx
    );

    return {
      reference: failed.reference,
      status: failed.status,
    };
  });
};

const reverseTransaction = async ({ userId, transactionId, idempotencyKey, ipAddress }) => {
  return prisma.$transaction(async (tx) => {
    const original = await findTransactionById(transactionId, tx);

    if (!original) {
      throw new ApiError(404, 'Transaction not found');
    }

    if (original.type === TRANSACTION_TYPE.REVERSAL) {
      throw new ApiError(400, 'Cannot reverse a reversal transaction');
    }

    if (original.senderWallet.userId !== userId) {
      throw new ApiError(403, 'Not allowed to reverse this transaction');
    }

    if (original.status !== TRANSACTION_STATUS.SUCCESS) {
      throw new ApiError(409, 'Only successful transactions can be reversed');
    }

    if (original.reversals.length > 0 || original.status === TRANSACTION_STATUS.REVERSED) {
      throw new ApiError(409, 'Transaction already reversed');
    }

    await lockTransaction(original.id, tx);

    const freshOriginal = await findTransactionById(transactionId, tx);

    if (freshOriginal.reversals.length > 0 || freshOriginal.status === TRANSACTION_STATUS.REVERSED) {
      throw new ApiError(409, 'Transaction already reversed');
    }

    const settlementWallet = await ensureSettlementWallet(tx);

    const reversalReference = generateReference('REV');

    let reversalTx = await createTransaction(
      {
        reference: reversalReference,
        type: TRANSACTION_TYPE.REVERSAL,
        amount: freshOriginal.amount,
        currency: freshOriginal.currency,
        status: TRANSACTION_STATUS.INITIATED,
        senderWalletId: freshOriginal.senderWalletId,
        receiverWalletId: freshOriginal.receiverWalletId,
        idempotencyKey,
        originalTransactionId: freshOriginal.id,
      },
      tx
    );

    reversalTx = await transitionStatus(reversalTx, TRANSACTION_STATUS.PENDING, tx);

    const ledgerEntries = [];

    if (freshOriginal.type === TRANSACTION_TYPE.INTERNAL) {
      await lockWallet(freshOriginal.senderWalletId, tx);
      await lockWallet(freshOriginal.receiverWalletId, tx);

      await assertSufficientBalance(freshOriginal.receiverWalletId, freshOriginal.amount, tx);

      ledgerEntries.push(
        {
          transactionId: reversalTx.id,
          walletId: freshOriginal.receiverWalletId,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amount: freshOriginal.amount,
        },
        {
          transactionId: reversalTx.id,
          walletId: freshOriginal.senderWalletId,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amount: freshOriginal.amount,
        }
      );
    } else if (freshOriginal.type === TRANSACTION_TYPE.EXTERNAL) {
      await lockWallet(freshOriginal.senderWalletId, tx);
      await lockWallet(settlementWallet.id, tx);

      await assertSufficientBalance(settlementWallet.id, freshOriginal.amount, tx);

      ledgerEntries.push(
        {
          transactionId: reversalTx.id,
          walletId: settlementWallet.id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amount: freshOriginal.amount,
        },
        {
          transactionId: reversalTx.id,
          walletId: freshOriginal.senderWalletId,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amount: freshOriginal.amount,
        }
      );
    } else {
      throw new ApiError(400, 'Unsupported transaction type for reversal');
    }

    await createManyLedgerEntries(ledgerEntries, tx);

    reversalTx = await transitionStatus(reversalTx, TRANSACTION_STATUS.SUCCESS, tx);

    assertTransition(freshOriginal.status, TRANSACTION_STATUS.REVERSED);
    await updateTransaction(
      freshOriginal.id,
      {
        status: TRANSACTION_STATUS.REVERSED,
      },
      tx
    );

    await logAudit(
      {
        action: AUDIT_ACTION.REVERSAL_CREATED,
        userId,
        walletId: freshOriginal.senderWalletId,
        success: true,
        ipAddress,
        metadata: {
          originalTransactionId: freshOriginal.id,
          reversalTransactionId: reversalTx.id,
        },
      },
      tx
    );

    return {
      reversalTransactionId: reversalTx.id,
      reference: reversalTx.reference,
      status: reversalTx.status,
      amount: reversalTx.amount.toString(),
      currency: reversalTx.currency,
      originalTransactionId: freshOriginal.id,
    };
  });
};

module.exports = {
  internalTransfer,
  externalTransfer,
  handleNibssWebhook,
  reverseTransaction,
};
