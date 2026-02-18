const Order = require('../models/Order.model');
const asyncHandler = require('../utils/asyncHandler');
const QueryFeatures = require('../utils/QueryFeatures');

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
    const features = new QueryFeatures(Order.find().populate('user', 'name email phone'), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const orders = await features.query;
    const total = await Order.countDocuments(features.query.getFilter());

    res.json({
        success: true,
        count: orders.length,
        total,
        data: orders
    });
});

// @desc    Get order by ID
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
const getOrderByIdAdmin = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name email phone')
        .populate('items.product');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    res.json({
        success: true,
        data: order
    });
});

// @desc    Update order status
// @route   PATCH /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, comment } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const currentStatus = order.status;
    const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['shipped', 'cancelled'],
        'shipped': ['out_for_delivery', 'cancelled'],
        'out_for_delivery': ['delivered', 'cancelled'],
        'delivered': [], // Final
        'cancelled': [], // Final
        'return_requested': ['returned', 'confirmed'], // confirmed or approved
        'returned': [] // Final
    };

    if (currentStatus === 'delivered' || currentStatus === 'cancelled' || currentStatus === 'returned') {
        res.status(400);
        throw new Error(`Cannot change status of a ${currentStatus} order`);
    }

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
        res.status(400);
        throw new Error(`Invalid transition from ${currentStatus} to ${status}`);
    }

    order.status = status;
    order.statusHistory.push({
        status,
        updatedBy: req.user._id,
        comment: comment || `Status updated to ${status}`
    });

    const updatedOrder = await order.save();

    res.json({
        success: true,
        message: `Order marked as ${status}`,
        data: updatedOrder
    });
});

module.exports = {
    getAllOrders,
    getOrderByIdAdmin,
    updateOrderStatus
};
