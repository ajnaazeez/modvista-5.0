const express = require('express');
const router = express.Router();
const {
    getOffersAdmin, createOfferAdmin, updateOfferAdmin, toggleOfferAdmin, deleteOfferAdmin
} = require('../controllers/admin.offer.controller');
const {
    getCouponsAdmin, createCouponAdmin, updateCouponAdmin, toggleCouponAdmin, deleteCouponAdmin
} = require('../controllers/admin.coupon.controller');
const { protect } = require('../middleware/auth.middleware');
const adminOnly = require('../middleware/admin.middleware');

// Protected and Admin Only
router.use(protect);
router.use(adminOnly);

// Offers Admin
router.route('/offers')
    .get(getOffersAdmin)
    .post(createOfferAdmin);

router.route('/offers/:id')
    .put(updateOfferAdmin)
    .delete(deleteOfferAdmin);

router.patch('/offers/:id/toggle', toggleOfferAdmin);

// Coupons Admin
router.route('/coupons')
    .get(getCouponsAdmin)
    .post(createCouponAdmin);

router.route('/coupons/:id')
    .put(updateCouponAdmin)
    .delete(deleteCouponAdmin);

router.patch('/coupons/:id/toggle', toggleCouponAdmin);

module.exports = router;
