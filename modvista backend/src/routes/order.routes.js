const express = require('express');
const router = express.Router();
const {
    createOrder,
    getMyOrders,
    getOrderById,
    setPaymentMethod,
    markOrderPaidMock,
    processReturn
} = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/:id', getOrderById);
router.patch('/:id/method', setPaymentMethod);
router.patch('/:id/pay', markOrderPaidMock);
router.post('/:id/return', processReturn);

module.exports = router;
