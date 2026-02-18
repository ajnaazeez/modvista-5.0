const asyncHandler = require('../utils/asyncHandler');
const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');
const Address = require('../models/Address.model');
const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model');

// @desc    Place a new order
// @route   POST /api/checkout
// @access  Private
const { calculatePriceBreakdown } = require('../utils/pricingEngine');
const Coupon = require('../models/Coupon.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

// @desc    Place a new order
// @route   POST /api/checkout
// @access  Private
const placeOrder = asyncHandler(async (req, res) => {
    const { addressId, contactPhone, paymentMethod } = req.body;

    if (!addressId) {
        res.status(400);
        throw new Error('Please select an address');
    }

    // 1. Get User Contact Info
    const user = await User.findById(req.user._id).select('email phone');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // 2. Get Cart and validate items
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
        res.status(400);
        throw new Error('Your cart is empty');
    }

    // 3. Stock Verification (Step 1: Before transaction)
    for (const item of cart.items) {
        if (!item.product) {
            res.status(400);
            throw new Error(`Product in your cart is no longer available`);
        }
        if (item.product.stock < item.quantity) {
            res.status(400);
            throw new Error(`Insufficient stock for ${item.product.name}. Available: ${item.product.stock}`);
        }
    }

    // 4. Validate Address
    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
        res.status(400);
        throw new Error('Invalid address selected');
    }

    // 5. Coupon Logic
    let coupon = null;
    if (cart.appliedCoupon && cart.appliedCoupon.code) {
        coupon = await Coupon.findOne({ code: cart.appliedCoupon.code, isActive: true });
        // Re-validate coupon expiry and minOrder
        const now = new Date();
        if (coupon && coupon.expiry && new Date(coupon.expiry) < now) {
            coupon = null; // Expired
        }
    }

    // 5.1 Fetch applicable Product Offers (auto-apply logic)
    const now = new Date();
    const Offer = require('../models/Offer.model'); // Ensure model is available
    const applicableOffer = await Offer.findOne({
        isActive: true,
        autoApply: true,
        $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] }
        ]
    }).sort({ createdAt: -1 });

    // 6. Pricing Breakdown
    const { orderItems, summary } = calculatePriceBreakdown(cart.items, coupon, applicableOffer);

    // 7. Execute Checkout
    const session = await mongoose.startSession();
    const useTransaction = mongoose.connection.transactionSupport;

    if (useTransaction) {
        await session.startTransaction();
    }

    const sessionOption = useTransaction ? { session } : {};

    try {
        // Re-verify stock inside transaction to prevent race conditions
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id).session(useTransaction ? session : null);
            if (product.stock < item.quantity) {
                throw new Error(`Stock changed for ${product.name}. Please refresh your cart.`);
            }
            // Atomic decrement
            product.stock -= item.quantity;
            await product.save(sessionOption);
        }

        // Create Order
        const isPaid = (paymentMethod === 'mock_razorpay' || paymentMethod === 'mock_wallet' || paymentMethod === 'wallet');

        if (paymentMethod === 'mock_wallet' || paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ user: req.user._id }).session(useTransaction ? session : null);
            if (!wallet) {
                wallet = await Wallet.create([{ user: req.user._id, balance: 0 }], sessionOption);
                wallet = Array.isArray(wallet) ? wallet[0] : wallet;
            }

            if (wallet.balance < summary.total) {
                throw new Error('Insufficient wallet balance');
            }

            wallet.balance -= summary.total;
            wallet.transactionHistory.push({
                type: 'debit',
                amount: summary.total,
                description: 'Payment for order #', // will update with ID suffix below
                relatedOrder: null
            });
            await wallet.save(sessionOption);
        }

        const orderResult = await Order.create([{
            user: req.user._id,
            items: orderItems,
            shippingAddress: {
                fullName: address.fullName,
                phone: address.phone,
                pincode: address.pincode,
                state: address.state,
                city: address.city,
                street: address.street,
                landmark: address.landmark
            },
            contact: {
                email: user.email,
                phone: contactPhone || user.phone
            },
            paymentMethod: paymentMethod || 'cod',
            subtotal: summary.subtotal,
            tax: summary.tax,
            shipping: summary.shipping,
            total: summary.total,
            status: 'pending',
            isPaid,
            paidAt: isPaid ? Date.now() : undefined,
            coupon: coupon ? { code: coupon.code, discount: summary.couponDiscount } : undefined,
            statusHistory: [{ status: 'pending', updatedBy: req.user._id, comment: 'Order placed successfully' }]
        }], sessionOption);

        const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

        // Update Wallet Transaction description with Order ID suffix
        if (paymentMethod === 'mock_wallet' || paymentMethod === 'wallet') {
            const shortId = order._id.toString().slice(-4).toUpperCase();
            const wallet = await Wallet.findOne({ user: req.user._id }).session(useTransaction ? session : null);
            if (wallet) {
                const lastTx = wallet.transactionHistory[wallet.transactionHistory.length - 1];
                if (lastTx && lastTx.description === 'Payment for order #') {
                    lastTx.description = `Payment for order #MV-${shortId}`;
                    lastTx.relatedOrder = order._id;
                    await wallet.save(sessionOption);
                }
            }
        }

        // Update Coupon usedCount
        if (coupon) {
            await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } }, sessionOption);
        }

        // Clear Cart
        cart.items = [];
        cart.appliedCoupon = undefined;
        await cart.save(sessionOption);

        if (useTransaction) {
            await session.commitTransaction();
        }
        session.endSession();

        res.status(201).json({
            success: true,
            orderId: order._id,
            total: summary.total,
            message: 'Order placed successfully'
        });

    } catch (error) {
        if (useTransaction) {
            await session.abortTransaction();
        }
        session.endSession();
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = {
    placeOrder
};
