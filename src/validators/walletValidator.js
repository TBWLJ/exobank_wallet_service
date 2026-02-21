const ApiError = require('../utils/apiError');

const validateInternalTransferInput = ({ receiverAccountNumber, amount, currency }) => {
  if (!receiverAccountNumber || amount === undefined) {
    throw new ApiError(400, 'receiverAccountNumber and amount are required');
  }

  if (!/^\d{10}$/.test(receiverAccountNumber)) {
    throw new ApiError(400, 'receiverAccountNumber must be 10 digits');
  }

  if (currency && currency !== 'NGN') {
    throw new ApiError(400, 'Only NGN is currently supported');
  }
};

const validateExternalTransferInput = ({ amount, externalBankCode, externalAccountNumber, currency }) => {
  if (amount === undefined || !externalBankCode || !externalAccountNumber) {
    throw new ApiError(400, 'amount, externalBankCode, and externalAccountNumber are required');
  }

  if (!/^\d{3,6}$/.test(externalBankCode)) {
    throw new ApiError(400, 'externalBankCode must be 3-6 digits');
  }

  if (!/^\d{10,20}$/.test(externalAccountNumber)) {
    throw new ApiError(400, 'externalAccountNumber must be 10-20 digits');
  }

  if (currency && currency !== 'NGN') {
    throw new ApiError(400, 'Only NGN is currently supported');
  }
};

const validateNibssWebhookInput = ({ reference, status }) => {
  if (!reference || !status) {
    throw new ApiError(400, 'reference and status are required');
  }

  if (!['SUCCESS', 'FAILED'].includes(status)) {
    throw new ApiError(400, 'status must be SUCCESS or FAILED');
  }
};

module.exports = {
  validateInternalTransferInput,
  validateExternalTransferInput,
  validateNibssWebhookInput,
};
