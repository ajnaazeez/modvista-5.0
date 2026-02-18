document.addEventListener('DOMContentLoaded', async () => {
    const { apiCall, requireLogin } = window.ModVistaAPI;

    // One-time localStorage cleanup (remove old cart data)
    // Uncomment these lines to clear localStorage cart data if needed:
    // localStorage.removeItem("modvista_cart");
    // localStorage.removeItem("modvista_applied_discount");

    // 1. Auth Guard
    if (!requireLogin('checkout.html')) return;

    // Elements
    const addressList = document.getElementById('address-list');
    const showFormBtn = document.getElementById('show-address-form');
    const addressFormContainer = document.getElementById('new-address-form');
    const addressForm = document.getElementById('address-form');
    const cancelAddressBtn = document.getElementById('cancel-address');
    const summaryItemsList = document.getElementById('summary-items');
    const payBtn = document.getElementById('pay-btn');
    const applyCouponBtn = document.getElementById('apply-coupon');
    const couponInput = document.getElementById('coupon-code');
    const couponMessage = document.getElementById('coupon-message');

    // State
    let addresses = [];
    let selectedAddressId = null;
    let appliedDiscount = 0;
    let subtotalAmount = 0;

    // --- Load User Profile ---

    async function loadMe() {
        try {
            const res = await apiCall('/users/me');
            if (res && res.success && res.user) {
                document.getElementById('contact-email').value = res.user.email || '';
                document.getElementById('contact-phone').value = res.user.phone || '';
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    // --- Address Functions ---

    async function loadAddresses() {
        try {
            const res = await apiCall('/addresses');
            if (res && res.data) {
                addresses = res.data;
                // Find selected: logic - checks 'isDefault' from backend
                const defaultAddr = addresses.find(a => a.isDefault);
                if (defaultAddr) {
                    selectedAddressId = defaultAddr._id;
                } else if (addresses.length > 0) {
                    // Fallback check if local selection logic needed? 
                    // Backend logic says "if user has no addresses, make it default automatically"
                    // So we might rely on that.
                    selectedAddressId = addresses[0]._id;
                }
                renderAddresses();
            }
        } catch (error) {
            console.error(error);
            addressList.innerHTML = '<p class="error">Failed to load addresses.</p>';
        }
    }

    function renderAddresses() {
        addressList.innerHTML = '';
        if (addresses.length === 0) {
            addressList.innerHTML = '<p>No addresses found. Please add one.</p>';
            updatePayButtonStatus();
            return;
        }

        addresses.forEach(addr => {
            const isSelected = addr._id === selectedAddressId;
            const card = document.createElement('div');
            card.className = `address-card ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `
                <input type="radio" name="address" value="${addr._id}" ${isSelected ? 'checked' : ''}>
                <span class="name">${addr.fullName} ${addr.isDefault ? '<small>(Default)</small>' : ''}</span>
                <span class="phone">${addr.phone}</span>
                <span class="full-address">${addr.house || ''} ${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}</span>
            `;

            card.addEventListener('click', () => selectAddress(addr._id));
            addressList.appendChild(card);
        });

        updatePayButtonStatus();
    }

    async function selectAddress(id) {
        selectedAddressId = id;
        renderAddresses();

        // Optional: Call API to set this as default if desired behavior is persistent selection
        // await apiCall(`/addresses/${id}/default`, { method: 'PUT' });
    }

    async function saveNewAddress(e) {
        e.preventDefault();

        const formData = {
            fullName: document.getElementById('addr-name').value,
            phone: document.getElementById('addr-phone').value,
            house: "N/A", // If field missing in form, provide default
            street: document.getElementById('addr-street').value,
            city: document.getElementById('addr-city').value,
            state: document.getElementById('addr-state').value,
            pincode: document.getElementById('addr-pincode').value,
            isDefault: addresses.length === 0 // Make default if first one
        };

        try {
            const res = await apiCall('/addresses', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (res && res.success) {
                addressForm.reset();
                addressFormContainer.classList.remove('open');
                showFormBtn.style.display = 'flex';
                await loadAddresses(); // Reload to get updated list
            }
        } catch (error) {
            alert(error.message);
        }
    }

    // --- Order Summary ---

    async function loadCartSummary() {
        try {
            const res = await apiCall('/cart');
            // res contains: { orderItems, summary, appliedCoupon }

            const cartItems = res.orderItems || [];
            subtotalAmount = res.summary?.subtotal || 0;
            appliedDiscount = res.summary?.couponDiscount || 0;

            renderOrderSummary(cartItems, res.summary);

            // If coupon already applied in backend, show it
            if (res.appliedCoupon && res.appliedCoupon.code) {
                const messageEl = document.getElementById('coupon-message');
                const codeInput = document.getElementById('coupon-code');
                if (codeInput) codeInput.value = res.appliedCoupon.code;
                if (messageEl) {
                    messageEl.textContent = "Coupon applied!";
                    messageEl.style.color = "#4ade80";
                }
            }

        } catch (error) {
            summaryItemsList.innerHTML = '<p>Error loading cart.</p>';
        }
    }

    function renderOrderSummary(items, summary = {}) {
        summaryItemsList.innerHTML = '';
        if (items.length === 0) {
            summaryItemsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Your cart is empty.</p>';
            updateTotals(summary);
            return;
        }

        items.forEach(item => {
            const price = item.finalUnitPrice || item.basePrice || 0;
            const quantity = item.quantity || 1;
            const itemTotal = item.itemFinalTotal || (price * quantity);

            const itemElement = document.createElement('div');
            itemElement.className = 'summary-item';
            const fallbackImg = 'assets/default-product.png';
            let img = fallbackImg;

            if (item.image) {
                img = item.image.startsWith('uploads/') ? `http://localhost:5000/${item.image}` : item.image;
            }

            itemElement.innerHTML = `
                <img src="${img}" alt="${item.name}" onerror="this.onerror=null;this.src='${fallbackImg}'">
                <div class="summary-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.variant} × ${quantity}</p>
                    ${item.finalUnitPrice < item.basePrice ? `<small style="color: #4ade80;">Offer Applied</small>` : ''}
                </div>
                <div class="summary-item-price">$${itemTotal.toFixed(2)}</div>
            `;
            summaryItemsList.appendChild(itemElement);
        });

        updateTotals(summary);
    }

    function updateTotals(summary = {}) {
        // Explicitly extract from summary object
        const subtotal = summary.subtotal || 0;
        const tax = summary.tax || 0;
        const discount = summary.couponDiscount || 0;
        const offerDiscount = summary.offerDiscountTotal || 0;
        const total = summary.total || 0;

        document.getElementById('summary-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('summary-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('summary-total').textContent = `$${total.toFixed(2)}`;

        // Handle Offer Discount Row
        let offerRow = document.getElementById('offer-row');
        if (!offerRow && offerDiscount > 0) {
            // Inserts before the discount-row if it exists
            offerRow = createSummaryRow('Offer Discount', 'summary-offer', 'offer-row', 'summary-subtotal');
        }

        if (offerRow) {
            if (offerDiscount > 0) {
                offerRow.style.display = 'flex';
                const offerSpan = document.getElementById('summary-offer');
                if (offerSpan) offerSpan.textContent = `-$${offerDiscount.toFixed(2)}`;
            } else {
                offerRow.style.display = 'none';
            }
        }

        if (discount > 0) {
            document.getElementById('discount-row').style.display = 'flex';
            document.getElementById('summary-discount').textContent = `-$${discount.toFixed(2)}`;
        } else {
            document.getElementById('discount-row').style.display = 'none';
        }

        updatePayButtonStatus();
    }

    function createSummaryRow(label, spanId, rowId, afterId) {
        const afterEl = document.getElementById(afterId)?.closest('.summary-row');
        if (!afterEl) return null;

        const row = document.createElement('div');
        row.className = 'summary-row';
        row.id = rowId;
        row.innerHTML = `<span>${label}</span><span id="${spanId}">$0.00</span>`;
        afterEl.parentNode.insertBefore(row, afterEl.nextSibling);
        return row;
    }

    async function applyCoupon() {
        const codeInput = document.getElementById('coupon-code');
        const messageEl = document.getElementById('coupon-message');
        const code = codeInput.value.trim();

        if (!code) {
            messageEl.textContent = "Please enter a coupon code";
            messageEl.style.color = "#ef4444";
            return;
        }

        try {
            // Assuming API_BASE and token are defined globally or passed
            const API_BASE = window.ModVistaAPI?.API_BASE || 'http://localhost:5000/api';
            const token = window.ModVistaAPI?.getToken() || localStorage.getItem('token');

            const response = await fetch(`${API_BASE}/coupons/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });
            const data = await response.json();

            if (data.success) {
                messageEl.textContent = "Coupon applied!";
                messageEl.style.color = "#4ade80";

                // Update Summary UI
                const discountRow = document.getElementById('discount-row');
                const summaryDiscount = document.getElementById('summary-discount');
                const summaryTotal = document.getElementById('summary-total');

                // Assuming data.data contains discount amount and total after discount
                // Adjust these based on actual API response structure
                appliedDiscount = data.data.discount; // Update global appliedDiscount
                updateTotals(); // Recalculate totals based on new appliedDiscount

                // Store applied coupon for order placement
                localStorage.setItem('appliedCoupon', JSON.stringify(data.data));
            } else {
                messageEl.textContent = data.message;
                messageEl.style.color = "#ef4444";

                // Reset UI
                appliedDiscount = 0; // Clear applied discount
                updateTotals(); // Recalculate totals
                localStorage.removeItem('appliedCoupon'); // Clear stored coupon
            }
        } catch (error) {
            console.error("Error applying coupon:", error);
            messageEl.textContent = "Error applying coupon. Please try again.";
            messageEl.style.color = "#ef4444";
        }
    }

    // The old handleCoupon function is replaced by the new applyCoupon logic.
    // function handleCoupon() {
    //     const code = couponInput.value.trim().toUpperCase();
    //     if (code === 'MODVISTA10') {
    //         appliedDiscount = subtotalAmount * 0.1;
    //         couponMessage.style.color = '#4cd137';
    //         couponMessage.textContent = 'Coupon applied! 10% discount added.';
    //         updateTotals();
    //     } else if (code === '') {
    //         appliedDiscount = 0;
    //         updateTotals();
    //         couponMessage.textContent = '';
    //     } else {
    //         appliedDiscount = 0;
    //         updateTotals();
    //         couponMessage.style.color = '#ff1f1f';
    //         couponMessage.textContent = 'Invalid coupon code.';
    //     }
    // }

    function updatePayButtonStatus() {
        if (subtotalAmount > 0 && selectedAddressId) {
            payBtn.disabled = false;
        } else {
            payBtn.disabled = true;
        }
    }

    // --- Order Placement ---

    async function placeOrder() {
        if (!selectedAddressId) return;

        payBtn.disabled = true;
        payBtn.textContent = 'Processing...';

        const appliedCouponData = localStorage.getItem('appliedCoupon');
        let couponCode = '';
        if (appliedCouponData) {
            const coupon = JSON.parse(appliedCouponData);
            couponCode = coupon.code;
        }

        const payload = {
            addressId: selectedAddressId,
            couponCode: couponCode, // Use the dynamically applied coupon code
            contactPhone: document.getElementById('contact-phone').value
        };

        try {
            const res = await apiCall('/checkout', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res && res.success) {
                localStorage.setItem('orderId', res.orderId);
                localStorage.removeItem('appliedCoupon'); // Clear coupon after successful order
                window.location.href = 'payment.html';
            }
        } catch (error) {
            alert(error.message);
            payBtn.disabled = false;
            payBtn.textContent = 'Pay Now';
        }
    }

    // --- Event Listeners ---

    // New coupon application logic
    if (document.getElementById('apply-coupon')) {
        document.getElementById('apply-coupon').addEventListener('click', applyCoupon);
    }

    // Check for pre-applied coupon (from coupons.html or previous session)
    const pendingCoupon = localStorage.getItem('appliedCoupon');
    if (pendingCoupon) {
        const couponData = JSON.parse(pendingCoupon);
        const couponCodeInput = document.getElementById('coupon-code');
        if (couponCodeInput) {
            couponCodeInput.value = couponData.code;
            // Automatically apply the coupon if it was previously stored
            applyCoupon();
        }
    }

    showFormBtn.addEventListener('click', () => {
        addressFormContainer.classList.add('open');
        showFormBtn.style.display = 'none';
        addressFormContainer.scrollIntoView({ behavior: 'smooth' });
    });

    cancelAddressBtn.addEventListener('click', () => {
        addressFormContainer.classList.remove('open');
        showFormBtn.style.display = 'flex';
    });

    addressForm.addEventListener('submit', saveNewAddress);
    applyCouponBtn.addEventListener('click', applyCoupon);
    payBtn.addEventListener('click', placeOrder);

    // Initialize
    await loadMe();
    await loadAddresses();
    await loadCartSummary();
});
