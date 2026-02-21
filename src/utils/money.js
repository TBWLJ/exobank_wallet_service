const { Prisma } = require('@prisma/client');
const ApiError = require('./apiError');

const toAmountDecimal = (value) => {
  let amount;
  try {
    amount = new Prisma.Decimal(value);
  } catch (error) {
    throw new ApiError(400, 'Invalid amount');
  }

  if (amount.lte(0)) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }

  if (!amount.toDecimalPlaces(2).equals(amount)) {
    throw new ApiError(400, 'Amount must have at most 2 decimal places');
  }

  return amount;
};

module.exports = {
  toAmountDecimal,
};
