const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Please add a coupon code'],
        unique: true,
        trim: true,
        uppercase: true
    },
    discType: {
        type: String,
        required: [true, 'Please add a discount type'],
        enum: ['percentage', 'flat']
    },
    discValue: {
        type: Number,
        required: [true, 'Please add a discount value'],
        min: [0, 'Discount value cannot be negative']
    },
    minOrder: {
        type: Number,
        default: 0,
        min: [0, 'Minimum order cannot be negative']
    },
    maxDiscount: {
        type: Number,
        min: [0, 'Maximum discount cannot be negative']
    },
    usageLimit: {
        type: Number,
        min: [1, 'Usage limit must be at least 1']
    },
    usedCount: {
        type: Number,
        default: 0
    },
    expiry: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure code is stored uppercase via pre-save hook
couponSchema.pre('save', function (next) {
    if (this.code) {
        this.code = this.code.toUpperCase().trim();
    }
    next();
});

module.exports = mongoose.model('Coupon', couponSchema);
