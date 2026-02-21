const express = require('express');
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, walletController.createWallet);
router.get('/me', authMiddleware, walletController.me);
router.get('/me/balance', authMiddleware, walletController.balance);

module.exports = router;
