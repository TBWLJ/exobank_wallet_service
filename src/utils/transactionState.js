const ApiError = require('./apiError');

const allowedTransitions = {
  INITIATED: ['PENDING'],
  PENDING: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
};

const assertTransition = (fromStatus, toStatus) => {
  const allowed = allowedTransitions[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(409, `Invalid status transition: ${fromStatus} -> ${toStatus}`);
  }
};

module.exports = {
  assertTransition,
};
