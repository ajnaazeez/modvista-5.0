const express = require('express');
const router = express.Router();
const { getAllOrders, getOrderByIdAdmin, updateOrderStatus } = require('../controllers/admin.order.controller');
const { protect } = require('../middleware/auth.middleware');
const adminOnly = require('../middleware/admin.middleware');

router.get('/orders', protect, adminOnly, getAllOrders);
router.get('/orders/:id', protect, adminOnly, getOrderByIdAdmin);
router.patch('/orders/:id/status', protect, adminOnly, updateOrderStatus);

module.exports = router;
