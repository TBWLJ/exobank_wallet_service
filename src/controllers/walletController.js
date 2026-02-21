const asyncHandler = require('../utils/asyncHandler');
const walletService = require('../services/walletService');

const createWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.createUserWallet({
    userId: req.user.id,
    ipAddress: req.ip,
  });

  res.status(201).json(wallet);
});

const me = asyncHandler(async (req, res) => {
  const wallet = await walletService.getMyWallet(req.user.id);
  res.status(200).json(wallet);
});

const balance = asyncHandler(async (req, res) => {
  const result = await walletService.getMyBalance(req.user.id);
  res.status(200).json(result);
});

module.exports = {
  createWallet,
  me,
  balance,
};
