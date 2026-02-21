const asyncHandler = require('../utils/asyncHandler');
const transferService = require('../services/transferService');
const {
  validateInternalTransferInput,
  validateExternalTransferInput,
  validateNibssWebhookInput,
} = require('../validators/walletValidator');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const internalTransfer = asyncHandler(async (req, res) => {
  validateInternalTransferInput(req.body);

  const result = await transferService.internalTransfer({
    userId: req.user.id,
    receiverAccountNumber: req.body.receiverAccountNumber,
    amount: req.body.amount,
    currency: req.body.currency || 'NGN',
    idempotencyKey: req.idempotencyKey,
    ipAddress: req.ip,
  });

  res.status(201).json(result);
});

const externalTransfer = asyncHandler(async (req, res) => {
  validateExternalTransferInput(req.body);

  const result = await transferService.externalTransfer({
    userId: req.user.id,
    amount: req.body.amount,
    currency: req.body.currency || 'NGN',
    externalBankCode: req.body.externalBankCode,
    externalAccountNumber: req.body.externalAccountNumber,
    idempotencyKey: req.idempotencyKey,
    ipAddress: req.ip,
  });

  res.status(201).json(result);
});

const nibssWebhook = asyncHandler(async (req, res) => {
  if (env.nibssWebhookSecret && req.get('x-webhook-secret') !== env.nibssWebhookSecret) {
    throw new ApiError(401, 'Invalid webhook secret');
  }

  validateNibssWebhookInput(req.body);

  const result = await transferService.handleNibssWebhook({
    reference: req.body.reference,
    status: req.body.status,
    ipAddress: req.ip,
    metadata: { source: 'webhook' },
  });

  res.status(200).json(result);
});

const reverse = asyncHandler(async (req, res) => {
  const result = await transferService.reverseTransaction({
    userId: req.user.id,
    transactionId: req.params.transactionId,
    idempotencyKey: req.idempotencyKey,
    ipAddress: req.ip,
  });

  res.status(201).json(result);
});

module.exports = {
  internalTransfer,
  externalTransfer,
  nibssWebhook,
  reverse,
};
