const express = require('express');
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middlewares/authMiddleware');
const transferRateLimitMiddleware = require('../middlewares/transferRateLimitMiddleware');
const idempotencyMiddleware = require('../middlewares/idempotencyMiddleware');

const router = express.Router();

router.post(
  '/internal',
  authMiddleware,
  transferRateLimitMiddleware,
  idempotencyMiddleware,
  transferController.internalTransfer
);

router.post(
  '/external',
  authMiddleware,
  transferRateLimitMiddleware,
  idempotencyMiddleware,
  transferController.externalTransfer
);

router.post(
  '/:transactionId/reverse',
  authMiddleware,
  transferRateLimitMiddleware,
  idempotencyMiddleware,
  transferController.reverse
);

router.post('/webhook/nibss', transferController.nibssWebhook);

module.exports = router;
