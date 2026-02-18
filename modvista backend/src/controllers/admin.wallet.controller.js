const Wallet = require('../models/Wallet.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const mongoose = require('mongoose');

/**
 * @desc    Get wallet statistics for admin dashboard
 * @route   GET /api/admin/wallet/stats
 * @access  Private/Admin
 */
exports.getWalletStats = async (req, res, next) => {
    try {
        // Total wallet balance across all users
        const totalBalanceResult = await Wallet.aggregate([
            {
                $group: {
                    _id: null,
                    totalBalance: { $sum: '$balance' }
                }
            }
        ]);
        const totalWalletBalance = totalBalanceResult.length > 0 ? totalBalanceResult[0].totalBalance : 0;

        // Total refunds issued (from embedded history)
        const refundsResult = await Wallet.aggregate([
            { $unwind: '$transactionHistory' },
            { $match: { 'transactionHistory.type': 'refund' } },
            {
                $group: {
                    _id: null,
                    totalRefunds: { $sum: '$transactionHistory.amount' }
                }
            }
        ]);
        const totalRefunds = refundsResult.length > 0 ? refundsResult[0].totalRefunds : 0;

        res.status(200).json({
            totalWalletBalance,
            totalRefunds,
            pendingRefunds: 0, // Embedded logic typically processed immediately
            failedRefunds: 0
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get all wallet transactions with filters
 * @route   GET /api/admin/wallet/transactions
 * @access  Private/Admin
 */
exports.getAllTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build aggregation pipeline for filtered transactions across all wallets
        const pipeline = [
            { $unwind: '$transactionHistory' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' }
        ];

        // Filters
        const match = {};
        if (req.query.type) match['transactionHistory.type'] = req.query.type;

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            match.$or = [
                { 'userInfo.name': searchRegex },
                { 'userInfo.email': searchRegex }
            ];
        }

        if (Object.keys(match).length > 0) pipeline.push({ $match: match });

        // Sort and Paginate
        pipeline.push({ $sort: { 'transactionHistory.createdAt': -1 } });

        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Wallet.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        const results = await Wallet.aggregate(pipeline);

        const transactions = results.map(r => ({
            ...r.transactionHistory,
            user: {
                _id: r.userInfo._id,
                name: r.userInfo.name,
                email: r.userInfo.email
            }
        }));

        res.status(200).json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Get specific user's wallet info
 * @route   GET /api/admin/wallet/user/:userId
 * @access  Private/Admin
 */
exports.getUserWallet = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.userId).select('name email');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const wallet = await Wallet.findOne({ user: req.params.userId });

        res.status(200).json({
            user: {
                ...user.toObject(),
                walletBalance: wallet ? wallet.balance : 0
            },
            recentTransactions: wallet ? wallet.transactionHistory.slice(-10).reverse() : []
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Process manual refund
 * @route   POST /api/admin/wallet/refund
 * @access  Private/Admin
 */
exports.processRefund = async (req, res, next) => {
    const session = await mongoose.startSession();
    const useTransaction = mongoose.connection.transactionSupport;

    if (useTransaction) {
        await session.startTransaction();
    }

    const sessionOption = useTransaction ? { session } : {};

    try {
        const { userId, orderId, amount, description } = req.body;

        if (!userId || !amount || amount <= 0) {
            throw new Error('Invalid refund data');
        }

        let wallet = await Wallet.findOne({ user: userId }).session(useTransaction ? session : null);
        if (!wallet) {
            wallet = await Wallet.create([{ user: userId, balance: 0 }], sessionOption);
            wallet = Array.isArray(wallet) ? wallet[0] : wallet;
        }

        // Update wallet balance and record transaction
        wallet.balance += Number(amount);
        wallet.transactionHistory.push({
            type: 'refund',
            amount: Number(amount),
            description: description || 'Manual refund by admin',
            relatedOrder: orderId || null
        });

        await wallet.save(sessionOption);

        if (useTransaction) {
            await session.commitTransaction();
        }
        session.endSession();

        res.status(200).json({
            message: 'Refund processed successfully',
            balance: wallet.balance
        });
    } catch (err) {
        if (useTransaction) {
            await session.abortTransaction();
        }
        session.endSession();
        next(err);
    }
};

// Placeholder for remaining legacy routes if needed, otherwise clean up
exports.retryFailedRefund = async (req, res) => {
    res.status(400).json({ message: 'Legacy route. All wallet transactions are now atomic.' });
};
