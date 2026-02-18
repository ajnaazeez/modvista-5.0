const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const asyncHandler = require('../utils/asyncHandler');
const QueryFeatures = require('../utils/QueryFeatures');

// @desc    Get all products (Admin)
// @route   GET /api/admin/products
// @access  Private/Admin
const adminGetProducts = asyncHandler(async (req, res) => {
    const features = new QueryFeatures(Product.find().populate('category', 'name slug'), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const products = await features.query;
    const count = await Product.countDocuments(features.query.getFilter());

    res.json({
        success: true,
        count: products.length,
        total: count,
        data: products
    });
});

// @desc    Create a product
// @route   POST /api/admin/products
// @access  Private/Admin
const adminCreateProduct = asyncHandler(async (req, res) => {
    const { name, description, price, category, images, stock } = req.body;

    if (!name || !description || price === undefined) {
        res.status(400);
        throw new Error('name, description, and price are required');
    }

    if (category) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            res.status(400);
            throw new Error('Invalid category');
        }
    }

    const product = await Product.create({
        name,
        description,
        price,
        category: category || null,
        images: Array.isArray(images) ? images : [],
        stock: stock ?? 0,
        isActive: true
    });

    res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
    });
});

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const adminUpdateProduct = asyncHandler(async (req, res) => {
    const { name, description, price, category, images, stock, isActive } = req.body;
    let product = await Product.findById(req.params.id);

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    if (category) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            res.status(400);
            throw new Error('Invalid category');
        }
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
    });
});

// @desc    Toggle product active status
// @route   PATCH /api/admin/products/:id/toggle-active
// @access  Private/Admin
const toggleProductActive = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
        success: true,
        message: `Product ${product.isActive ? 'enabled' : 'disabled'}`,
        data: product
    });
});

// @desc    Update product stock
// @route   PATCH /api/admin/products/:id/stock
// @access  Private/Admin
const updateProductStock = asyncHandler(async (req, res) => {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
        res.status(400);
        throw new Error('Valid stock count is required');
    }

    const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    res.json({
        success: true,
        message: 'Stock updated',
        data: product
    });
});

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const adminDeleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    await product.deleteOne();

    res.json({
        success: true,
        message: 'Product deleted'
    });
});

module.exports = {
    adminGetProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
    toggleProductActive,
    updateProductStock
};
