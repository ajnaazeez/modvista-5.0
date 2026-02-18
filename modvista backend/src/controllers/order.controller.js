const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');
const Address = require('../models/Address.model');
const Wallet = require('../models/Wallet.model');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
    const { addressId, paymentMethod } = req.body;

    // 1. Fetch cart and populate products
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
        res.status(400);
        throw new Error('Your cart is empty');
    }

    // 2. Find and snapshot address
    const address = await Address.findById(addressId);
    if (!address || address.user.toString() !== req.user._id.toString()) {
        res.status(404);
        throw new Error('Shipping address not found or invalid');
    }

    // 3. Prepare order items (snapshots)
    const orderItems = cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.images[0] || '', // Using first image
        variant: item.variant || 'Standard'
    }));

    // 4. Calculate totals
    const subtotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shipping = 0; // MVP: Free shipping
    const tax = 0; // MVP: No tax implementation yet
    const total = subtotal + shipping + tax;

    // 5. Create Order & Process Wallet Payment
    const session = await mongoose.startSession();
    const useTransaction = mongoose.connection.transactionSupport;

    if (useTransaction) {
        await session.startTransaction();
    }

    const sessionOption = useTransaction ? { session } : {};

    let order;
    try {
        const paymentMethodLower = (paymentMethod || 'cod').toLowerCase();

        order = new Order({
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
            paymentMethod: paymentMethodLower,
            subtotal,
            shipping,
            tax,
            total,
            status: 'pending'
        });

        // Use Wallet Logic
        if (paymentMethodLower === 'wallet') {
            let wallet = await Wallet.findOne({ user: req.user._id }).session(useTransaction ? session : null);

            // Auto-create wallet if missing (safety)
            if (!wallet) {
                wallet = await Wallet.create([{ user: req.user._id, balance: 0 }], sessionOption);
                wallet = Array.isArray(wallet) ? wallet[0] : wallet;
            }

            if (wallet.balance < total) {
                throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance}`);
            }

            // Deduct funds
            wallet.balance -= total;
            wallet.transactionHistory.push({
                type: 'debit',
                amount: total,
                description: `Payment for Order #${order._id.toString().substring(order._id.length - 8).toUpperCase()}`,
                relatedOrder: order._id
            });

            await wallet.save(sessionOption);

            // Mark order as paid
            order.isPaid = true;
            order.paidAt = Date.now();
            order.status = 'confirmed';
        }

        await order.save(sessionOption);

        // 6. Clear user cart
        cart.items = [];
        await cart.save(sessionOption);

        if (useTransaction) {
            await session.commitTransaction();
        }
        session.endSession();

        res.status(201).json({
            success: true,
            data: order
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400);
        throw error;
    }
});

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
    });
});

// @desc    Get order by ID (Supports Full ObjectId or Short ID suffix)
// @route   GET /api/orders/:id
// @access  Private (owner only)
const getOrderById = asyncHandler(async (req, res) => {
    let { id } = req.params;
    const userId = req.user._id;

    let order;

    if (mongoose.Types.ObjectId.isValid(id)) {
        // Direct lookup if valid ObjectId
        order = await Order.findOne({ _id: id, user: userId }).populate('items.product');
    } else {
        // Fallback: Search by "Short ID" (suffix)
        // 1. Clean the ID (remove 'MV-' prefix if present, trim whitespace)
        const searchId = id.replace(/^MV-?/i, '').trim().toUpperCase();

        // 2. Fetch user's orders (Sorted by Newest First)
        // We only fetch _id to filter in memory first
        const userOrders = await Order.find({ user: userId })
            .select('_id')
            .sort({ createdAt: -1 });

        // 3. Find match
        const match = userOrders.find(o => {
            const shortParams = o._id.toString().toUpperCase();
            return shortParams.endsWith(searchId);
        });

        if (match) {
            order = await Order.findOne({ _id: match._id }).populate('items.product');
        }
    }

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    res.json({
        success: true,
        data: order
    });
});

// @desc    Set/Update payment method for an order
// @route   PATCH /api/orders/:id/method
// @access  Private (owner only)
const setPaymentMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const { paymentMethod } = req.body;

    const allowed = ['cod', 'mock_razorpay', 'mock_wallet'];
    if (!allowed.includes(paymentMethod)) {
        res.status(400);
        throw new Error('Invalid payment method');
    }

    const order = await Order.findOne({ _id: id, user: userId });

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    order.paymentMethod = paymentMethod;

    // If COD, mark as unpaid and pending
    if (paymentMethod === 'cod') {
        order.isPaid = false;
        order.status = 'pending';
    }

    await order.save();

    res.json({
        success: true,
        data: order
    });
});

// @desc    Process return and refund to wallet
// @route   POST /api/orders/:id/return
// @access  Private (owner only)
const processReturn = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
        res.status(400);
        throw new Error('Please provide a reason for return');
    }

    const session = await mongoose.startSession();
    const useTransaction = mongoose.connection.transactionSupport;

    if (useTransaction) {
        await session.startTransaction();
    }

    const sessionOption = useTransaction ? { session } : {};

    try {
        const order = await Order.findOne({ _id: id, user: req.user._id }).session(useTransaction ? session : null);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.status !== 'delivered') {
            throw new Error('Only delivered orders can be returned');
        }

        // 1. Process Order Status
        order.status = 'returned';
        order.statusHistory.push({
            status: 'returned',
            updatedBy: req.user._id,
            comment: `Order returned and refunded to wallet. Reason: ${reason}`
        });

        // 2. Process Refund to Wallet
        let wallet = await Wallet.findOne({ user: req.user._id }).session(useTransaction ? session : null);
        if (!wallet) {
            wallet = await Wallet.create([{ user: req.user._id, balance: 0 }], sessionOption);
            wallet = Array.isArray(wallet) ? wallet[0] : wallet;
        }

        const refundAmount = order.total;
        wallet.balance += refundAmount;
        wallet.transactionHistory.push({
            type: 'refund',
            amount: refundAmount,
            description: `Refund for returned Order #${order._id.toString().substring(order._id.length - 8).toUpperCase()}`,
            relatedOrder: order._id
        });

        await wallet.save(sessionOption);
        await order.save(sessionOption);

        if (useTransaction) {
            await session.commitTransaction();
        }
        session.endSession();

        res.json({
            success: true,
            message: 'Order returned successfully. Refund credited to your wallet.',
            data: order
        });

    } catch (error) {
        if (useTransaction) {
            await session.abortTransaction();
        }
        session.endSession();
        res.status(400);
        throw error;
    }
});

// @desc    Mock payment (Mark order as paid)
// @route   PATCH /api/orders/:id/pay
// @access  Private (owner only)
const markOrderPaidMock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id, user: req.user._id });

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.statusHistory.push({
        status: order.status,
        updatedBy: req.user._id,
        comment: 'Order marked as paid (Mock)'
    });

    await order.save();

    res.json({
        success: true,
        message: 'Order marked as paid',
        data: order
    });
});

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    setPaymentMethod,
    markOrderPaidMock,
    processReturn
};
