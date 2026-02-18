const Coupon = require('../models/Coupon.model');
const asyncHandler = require('../utils/asyncHandler');
const QueryFeatures = require('../utils/QueryFeatures');

// @desc    Get all coupons (Admin)
// @route   GET /api/admin/coupons
// @access  Private/Admin
const getCouponsAdmin = asyncHandler(async (req, res) => {
    const features = new QueryFeatures(Coupon.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const coupons = await features.query;
    const total = await Coupon.countDocuments(features.query.getFilter());

    res.json({ success: true, count: coupons.length, total, data: coupons });
});

// @desc    Create a coupon (Admin)
// @route   POST /api/admin/coupons
// @access  Private/Admin
const createCouponAdmin = asyncHandler(async (req, res) => {
    const { code, discType, discValue, startDate, endDate } = req.body;

    if (!code || !discType || discValue === undefined) {
        res.status(400);
        throw new Error('Please provide code, discount type and value');
    }

    // Validation: Max 70% for percentage discounts
    if (discType === 'percentage' && discValue > 70) {
        res.status(400);
        throw new Error('Percentage discount cannot exceed 70%');
    }

    // Validation: Date logic
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
        res.status(400);
        throw new Error('Start date cannot be in the past');
    }
    if (start > end) {
        res.status(400);
        throw new Error('Start date cannot be after end date');
    }

    const normalizedCode = code.toUpperCase().trim();
    const existingCoupon = await Coupon.findOne({ code: normalizedCode });
    if (existingCoupon) {
        res.status(400);
        throw new Error('Coupon code already exists');
    }

    const coupon = await Coupon.create({ ...req.body, code: normalizedCode });
    res.status(201).json({ success: true, data: coupon });
});

// @desc    Update a coupon (Admin)
// @route   PUT /api/admin/coupons/:id
// @access  Private/Admin
const updateCouponAdmin = asyncHandler(async (req, res) => {
    const { code, discType, discValue, startDate, endDate } = req.body;
    let coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404);
        throw new Error('Coupon not found');
    }

    if (code) {
        const normalizedCode = code.toUpperCase().trim();
        const existingCoupon = await Coupon.findOne({ code: normalizedCode, _id: { $ne: req.params.id } });
        if (existingCoupon) {
            res.status(400);
            throw new Error('Coupon code already exists');
        }
        req.body.code = normalizedCode;
    }

    if (discType === 'percentage' || (coupon.discType === 'percentage' && discValue !== undefined)) {
        const checkValue = discValue !== undefined ? discValue : coupon.discValue;
        if (checkValue > 70) {
            res.status(400);
            throw new Error('Percentage discount cannot exceed 70%');
        }
    }

    if (startDate || endDate) {
        const start = new Date(startDate || coupon.startDate);
        const end = new Date(endDate || coupon.endDate);
        if (start > end) {
            res.status(400);
            throw new Error('Start date cannot be after end date');
        }
    }

    coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.json({ success: true, data: coupon });
});

// @desc    Toggle coupon active status (Admin)
// @route   PATCH /api/admin/coupons/:id/toggle
// @access  Private/Admin
const toggleCouponAdmin = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404);
        throw new Error('Coupon not found');
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
        success: true,
        message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`,
        data: coupon
    });
});

// @desc    Delete a coupon (Admin)
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
const deleteCouponAdmin = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404);
        throw new Error('Coupon not found');
    }

    await coupon.deleteOne();
    res.json({ success: true, message: 'Coupon deleted' });
});

module.exports = {
    getCouponsAdmin,
    createCouponAdmin,
    updateCouponAdmin,
    toggleCouponAdmin,
    deleteCouponAdmin
};
