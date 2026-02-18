const express = require('express');
const router = express.Router();
const {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem
} = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// Note: asyncHandler is now applied directly in the controller methods
router.get('/', protect, getCart);
router.post('/', protect, addToCart);
router.put('/item/:itemId', protect, updateCartItem);
router.delete('/item/:itemId', protect, removeCartItem);

module.exports = router;
