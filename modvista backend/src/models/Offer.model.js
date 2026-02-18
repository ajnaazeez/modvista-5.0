const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add an offer title'],
        trim: true
    },
    bannerImage: {
        type: String,
        required: false
    },
    discountType: {
        type: String,
        required: [true, 'Please add a discount type'],
        enum: ['percentage', 'flat']
    },
    value: {
        type: Number,
        required: [true, 'Please add a discount value'],
        min: [0, 'Discount value cannot be negative']
    },
    applicable: {
        type: String,
        enum: ['all', 'exterior', 'interior', 'performance'],
        default: 'all'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    autoApply: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
