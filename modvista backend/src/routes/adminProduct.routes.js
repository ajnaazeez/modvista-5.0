const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
    adminGetProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct
} = require('../controllers/adminProduct.controller');

router.use(protect, adminOnly);

router.get('/products', asyncHandler(adminGetProducts));
router.post('/products', asyncHandler(adminCreateProduct));
router.put('/products/:id', asyncHandler(adminUpdateProduct));
router.delete('/products/:id', asyncHandler(adminDeleteProduct));

module.exports = router;
