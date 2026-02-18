const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
    getWalletStats,
    getAllTransactions,
    getUserWallet,
    processRefund,
    retryFailedRefund
} = require('../controllers/admin.wallet.controller');

// GET /api/admin/wallet/stats
router.get('/stats', protect, adminOnly, getWalletStats);

// GET /api/admin/wallet/transactions
router.get('/transactions', protect, adminOnly, getAllTransactions);

// GET /api/admin/wallet/user/:userId
router.get('/user/:userId', protect, adminOnly, getUserWallet);

// POST /api/admin/wallet/refund
router.post('/refund', protect, adminOnly, processRefund);

// POST /api/admin/wallet/retry/:transactionId
router.post('/retry/:transactionId', protect, adminOnly, retryFailedRefund);

module.exports = router;
