/**
 * Pricing Engine to handle consistent price calculations
 */

const calculatePriceBreakdown = (items, coupon = null, offer = null, shippingFee = 0) => {
    let subtotal = 0;
    let offerBreakdown = [];
    let offerDiscountTotal = 0;

    // 1. Process Items and Apply Product-Specific Offers (if applicable)
    // Note: Items already contain 'price' which should be the base price.
    const orderItems = items.map(item => {
        const product = item.product;
        const basePrice = product.price;
        let finalUnitPrice = basePrice;
        let itemOfferDiscount = 0;

        // If there's an offer that applies to this item (e.g., matching category or 'all')
        if (offer && offer.isActive) {
            const now = new Date();
            const starts = offer.startDate ? new Date(offer.startDate) : null;
            const ends = offer.endDate ? new Date(offer.endDate) : null;

            if ((!starts || now >= starts) && (!ends || now <= ends)) {
                if (offer.applicable === 'all' || (product.category && product.category.name && product.category.name.toLowerCase() === offer.applicable.toLowerCase())) {
                    if (offer.discountType === 'percentage') {
                        itemOfferDiscount = (basePrice * offer.value) / 100;
                    } else if (offer.discountType === 'flat') {
                        itemOfferDiscount = offer.value;
                    }
                    finalUnitPrice = Math.max(0, basePrice - itemOfferDiscount);
                }
            }
        }

        const itemTotal = basePrice * item.quantity;
        const itemFinalTotal = finalUnitPrice * item.quantity;

        subtotal += itemTotal;
        offerDiscountTotal += (itemTotal - itemFinalTotal);

        return {
            product: product._id,
            name: product.name,
            basePrice: basePrice,
            price: parseFloat(finalUnitPrice.toFixed(2)), // Added for Order model validation
            finalUnitPrice: parseFloat(finalUnitPrice.toFixed(2)),
            quantity: item.quantity,
            image: product.images && product.images[0] ? product.images[0] : '',
            variant: item.variant || 'Standard',
            itemSubtotal: parseFloat(itemTotal.toFixed(2)),
            itemFinalTotal: parseFloat(itemFinalTotal.toFixed(2))
        };
    });

    const discountedSubtotal = subtotal - offerDiscountTotal;

    // 2. Apply Coupon Discount on the discounted subtotal
    let couponDiscount = 0;
    if (coupon && coupon.isActive) {
        const now = new Date();
        if (!coupon.expiry || now <= new Date(coupon.expiry)) {
            if (discountedSubtotal >= (coupon.minOrder || 0)) {
                if (coupon.discType === 'flat') {
                    couponDiscount = coupon.discValue;
                } else if (coupon.discType === 'percentage') {
                    couponDiscount = discountedSubtotal * (coupon.discValue / 100);
                    if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                        couponDiscount = coupon.maxDiscount;
                    }
                }
            }
        }

        // Cap discount to discountedSubtotal
        if (couponDiscount > discountedSubtotal) {
            couponDiscount = discountedSubtotal;
        }
    }

    const taxRate = 0.00; // Keep 0 for now as per MVP requirements if needed, or 0.18 for GST
    const taxableAmount = discountedSubtotal - couponDiscount;
    const tax = taxableAmount * taxRate;
    const finalTotal = taxableAmount + tax + shippingFee;

    return {
        orderItems,
        summary: {
            subtotal: parseFloat(subtotal.toFixed(2)),
            offerDiscountTotal: parseFloat(offerDiscountTotal.toFixed(2)),
            discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
            couponDiscount: parseFloat(couponDiscount.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            shipping: parseFloat(shippingFee.toFixed(2)),
            total: parseFloat(finalTotal.toFixed(2))
        }
    };
};

module.exports = { calculatePriceBreakdown };
