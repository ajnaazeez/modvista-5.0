document.addEventListener('DOMContentLoaded', async () => {
    // ====== 1. AUTH GUARD (JWT Token Check) ======
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login to continue');
        window.location.href = 'login.html';
        return;
    }

    // ====== 2. GET ORDER ID ======
    const orderId = localStorage.getItem('orderId');
    if (!orderId) {
        alert('No order found. Redirecting to cart...');
        window.location.href = 'cart.html';
        return;
    }

    // ====== 3. ELEMENTS ======
    const paymentCards = document.querySelectorAll('.payment-method-card');
    const finalPayBtn = document.getElementById('final-pay-btn');
    const codCheckbox = document.getElementById('confirm-cod');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusText = document.getElementById('status-text');
    const finalSummaryItems = document.getElementById('final-summary-items');

    // ====== 4. STATE ======
    let selectedMethod = 'razorpay';
    let order = null;
    let userWalletBalance = 0; // Will be fetched from backend
    let isWalletApplied = false;
    let currentTotal = 0;
    const COD_LIMIT = 50000;

    // ====== 5. LOAD ORDER & WALLET FROM BACKEND ======
    async function loadInitialData() {
        try {
            // Fetch Order and Wallet Balance in parallel
            const [orderRes, walletRes] = await Promise.all([
                window.ModVistaAPI.apiCall(`/orders/${orderId}`),
                window.ModVistaAPI.apiCall('/wallet/balance')
            ]);

            if (!orderRes || !orderRes.success) throw new Error('Failed to load order');
            order = orderRes.data;

            if (walletRes && walletRes.success) {
                userWalletBalance = walletRes.balance || 0;
            }

            console.log('Data loaded:', { order, userWalletBalance });

            renderOrderSummary();
            initWalletUI();
        } catch (error) {
            console.error('Load data error:', error);
            alert('Failed to load required data: ' + error.message);
            window.location.href = 'cart.html';
        }
    }

    // ====== 6. RENDER ORDER SUMMARY ======
    function renderOrderSummary() {
        if (!order) return;

        // Display Address
        const addr = order.shippingAddress;
        document.getElementById('display-name').textContent = addr.fullName || 'N/A';
        document.getElementById('display-address').textContent =
            `${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}`;

        // Display Items
        finalSummaryItems.innerHTML = '';
        order.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'summary-item';
            row.style.marginBottom = '15px';

            // Handle image path (frontend assets vs backend uploads)
            let imgSrc = 'assets/default-product.png';
            if (item.image) {
                if (item.image.startsWith('uploads/')) {
                    imgSrc = `http://localhost:5000/${item.image}`;
                } else if (item.image.startsWith('assets/')) {
                    imgSrc = item.image;
                } else {
                    imgSrc = `assets/${item.image}`;
                }
            }

            row.innerHTML = `
                <img src="${imgSrc}" alt="${item.name}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">
                <div class="summary-item-info">
                    <h4 style="font-size: 0.85rem;">${item.name}</h4>
                    <p style="font-size: 0.75rem;">Qty: ${item.quantity}</p>
                </div>
                <div class="summary-item-price" style="font-size: 0.85rem;">$${(item.price * item.quantity).toFixed(2)}</div>
            `;
            finalSummaryItems.appendChild(row);
        });

        // Display Totals from Backend Order
        const subtotal = parseFloat(order.subtotal);
        const tax = parseFloat(order.tax);
        const total = parseFloat(order.total);

        currentTotal = total;

        document.getElementById('final-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('final-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('final-total').textContent = `$${total.toFixed(2)}`;

        // Check COD limit
        checkCODLimit(subtotal);
    }

    // ====== 7. WALLET UI ======
    function initWalletUI() {
        const walletSection = document.getElementById('wallet-section');
        const balanceDisplay = document.getElementById('wallet-balance-amount');
        const walletToggle = document.getElementById('wallet-toggle');

        if (userWalletBalance > 0) {
            walletSection.style.display = 'block';
            balanceDisplay.textContent = `$${userWalletBalance.toFixed(2)}`;

            // Auto-apply if wallet covers full amount
            if (userWalletBalance >= currentTotal) {
                walletToggle.checked = true;
                isWalletApplied = true;
                calculateTotals();
            }
        }

        walletToggle.addEventListener('change', (e) => {
            isWalletApplied = e.target.checked;
            calculateTotals();
        });
    }

    // ====== 8. CALCULATE TOTALS WITH WALLET ======
    function calculateTotals() {
        if (!order) return;

        const subtotal = parseFloat(order.subtotal);
        const tax = parseFloat(order.tax);
        let payableAmount = subtotal + tax;

        let walletDeduction = 0;
        let isFullCoverage = false;

        if (isWalletApplied) {
            walletDeduction = Math.min(payableAmount, userWalletBalance);
            payableAmount -= walletDeduction;

            if (payableAmount <= 0) {
                payableAmount = 0;
                isFullCoverage = true;
            }
        }

        updateUIForCoverage(isFullCoverage, walletDeduction);

        // Update Wallet Discount Row
        const walletRow = document.getElementById('wallet-discount-row');
        if (walletDeduction > 0) {
            walletRow.style.display = 'flex';
            document.getElementById('wallet-discount').textContent = `-$${walletDeduction.toFixed(2)}`;

            const msgContainer = document.getElementById('wallet-applied-msg');
            const msgText = document.getElementById('wallet-msg-text');
            msgContainer.style.display = 'block';
            document.getElementById('wallet-deduction').textContent = `-$${walletDeduction.toFixed(2)}`;

            if (isFullCoverage) {
                msgText.innerHTML = 'Full amount covered by wallet.';
            } else {
                msgText.innerHTML = `Wallet Applied: <span class="neon-text">-$${walletDeduction.toFixed(2)}</span>`;
            }
        } else {
            walletRow.style.display = 'none';
            document.getElementById('wallet-applied-msg').style.display = 'none';
        }

        document.getElementById('final-total').textContent = `$${payableAmount.toFixed(2)}`;
        currentTotal = payableAmount;

        // Update Button State
        updateButtonState(payableAmount, isFullCoverage);
    }

    // ====== 9. UI COVERAGE HANDLING ======
    function updateUIForCoverage(isFullCoverage, deduction) {
        const paymentGrid = document.getElementById('payment-methods-grid');
        const fullCoverageMsg = document.getElementById('full-wallet-coverage-msg');
        const totalLabel = document.querySelector('.summary-row.total span:first-child');
        const walletToggle = document.getElementById('wallet-toggle');

        if (isFullCoverage) {
            paymentGrid.classList.add('disabled');
            fullCoverageMsg.style.display = 'block';
            totalLabel.textContent = 'Total Payable';
            walletToggle.disabled = true;

            // Add COD block message
            const codCard = document.querySelector('.payment-method-card[data-method="cod"]');
            if (codCard && !codCard.querySelector('.wallet-block-msg')) {
                const details = codCard.querySelector('.method-details');
                const msg = document.createElement('p');
                msg.className = 'wallet-block-msg';
                msg.style = 'color: var(--neon-red); font-size: 0.75rem; margin-top: 5px; font-weight: 600;';
                msg.innerHTML = '<i class="fas fa-ban"></i> Cash on Delivery is unavailable because this order is fully paid using wallet balance';
                details.appendChild(msg);
            }
        } else {
            paymentGrid.classList.remove('disabled');
            fullCoverageMsg.style.display = 'none';
            walletToggle.disabled = false;

            // Remove COD message
            const codCard = document.querySelector('.payment-method-card[data-method="cod"]');
            if (codCard) {
                const msg = codCard.querySelector('.wallet-block-msg');
                if (msg) msg.remove();
            }

            if (isWalletApplied) {
                totalLabel.textContent = 'Remaining Amount';
            } else {
                totalLabel.textContent = 'Total Amount';
            }
        }
    }

    // ====== 10. COD LIMIT CHECK ======
    function checkCODLimit(subtotal) {
        if (subtotal > COD_LIMIT) {
            const codCard = document.querySelector('.payment-method-card[data-method="cod"]');
            if (codCard) {
                codCard.style.opacity = '0.5';
                codCard.style.pointerEvents = 'none';
                const details = codCard.querySelector('.method-details p');
                details.innerHTML += ` <br><span style="color: var(--neon-red); font-weight: bold; font-size: 0.75rem;">Unavailable for orders above $${COD_LIMIT}</span>`;
            }
        }
    }

    // ====== 11. BUTTON STATE UPDATE ======
    function updateButtonState(payableAmount, isFullCoverage) {
        if (isFullCoverage) {
            finalPayBtn.textContent = 'Place Order (Paid by Wallet)';
            finalPayBtn.disabled = false;
        } else {
            if (selectedMethod === 'cod') {
                finalPayBtn.textContent = `Confirm COD Order ($${payableAmount.toFixed(2)})`;
                checkButtonStatus();
            } else {
                finalPayBtn.textContent = `Pay $${payableAmount.toFixed(2)} with Razorpay`;
                finalPayBtn.disabled = false;
            }
        }
    }

    // ====== 12. PAYMENT METHOD SELECTION ======
    paymentCards.forEach(card => {
        card.addEventListener('click', async () => {
            // Disable selection if full wallet coverage
            if (isWalletApplied && currentTotal <= 0 && document.getElementById('payment-methods-grid').classList.contains('disabled')) return;

            const method = card.dataset.method;
            selectedMethod = method;

            // Update UI
            paymentCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input').checked = true;

            // Map to backend payment method format
            let backendMethod = method === 'razorpay' ? 'mock_razorpay' : 'cod';

            // Call backend to set payment method
            try {
                await window.ModVistaAPI.apiCall(`/orders/${orderId}/method`, {
                    method: 'PATCH',
                    body: JSON.stringify({ paymentMethod: backendMethod })
                });
            } catch (error) {
                console.error('Failed to set payment method:', error);
            }

            const total = currentTotal;

            // Update Button Text
            if (method === 'razorpay') {
                finalPayBtn.textContent = `Pay $${total.toFixed(2)} with Razorpay`;
            } else {
                finalPayBtn.textContent = `Confirm COD Order ($${total.toFixed(2)})`;
            }

            checkButtonStatus();
        });
    });

    // ====== 13. BUTTON STATUS CHECK ======
    function checkButtonStatus() {
        if (selectedMethod === 'cod') {
            if (currentTotal > 0) {
                finalPayBtn.disabled = !codCheckbox.checked;
            } else {
                finalPayBtn.disabled = false;
            }
        } else {
            finalPayBtn.disabled = false;
        }
    }

    codCheckbox.addEventListener('change', checkButtonStatus);

    // ====== 14. PAYMENT PROCESSING ======
    finalPayBtn.addEventListener('click', async () => {
        document.getElementById('wallet-toggle').disabled = true;
        loadingOverlay.style.display = 'flex';

        let msg = 'Processing...';
        if (currentTotal === 0) {
            msg = 'Debiting Wallet...';
        } else if (selectedMethod === 'razorpay') {
            msg = 'Connecting to Razorpay...';
        } else {
            msg = 'Placing Order...';
        }

        statusText.textContent = msg;

        // Determine payment method to send
        let paymentMethod = 'mock_wallet';
        if (currentTotal > 0) {
            paymentMethod = selectedMethod === 'razorpay' ? 'mock_razorpay' : 'cod';
        }

        try {
            if (selectedMethod === 'razorpay' && currentTotal > 0) {
                // Simulate Razorpay flow
                setTimeout(async () => {
                    statusText.textContent = 'Verifying Transaction...';
                    setTimeout(async () => {
                        await processPayment(paymentMethod);
                    }, 2000);
                }, 1500);
            } else if (selectedMethod === 'cod' && currentTotal > 0) {
                // COD: Don't call /pay endpoint, just redirect
                setTimeout(async () => {
                    await processSuccess('cod');
                }, 1500);
            } else {
                // Wallet full coverage
                setTimeout(async () => {
                    await processPayment(paymentMethod);
                }, 1500);
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed: ' + error.message);
            loadingOverlay.style.display = 'none';
            document.getElementById('wallet-toggle').disabled = false;
        }
    });

    // ====== 15. PROCESS PAYMENT (Call backend) ======
    async function processPayment(paymentMethod) {
        try {
            statusText.textContent = 'Finalizing payment...';

            const res = await window.ModVistaAPI.apiCall(`/orders/${orderId}/pay`, {
                method: 'PATCH',
                body: JSON.stringify({ paymentMethod })
            });

            if (res && res.success) {
                await processSuccess(paymentMethod);
            } else {
                throw new Error('Payment failed');
            }
        } catch (error) {
            console.error('Process payment error:', error);
            alert('Payment processing failed: ' + error.message);
            loadingOverlay.style.display = 'none';
            document.getElementById('wallet-toggle').disabled = false;
        }
    }

    // ====== 16. PROCESS SUCCESS ======
    async function processSuccess(paymentMethod) {
        statusText.textContent = 'Order Placed Successfully!';

        // Ensure orderId exists before redirecting
        if (!orderId) {
            alert("OrderId missing. Please go back to checkout and place order again.");
            window.location.href = "checkout.html";
            return;
        }

        // Save order info for backup (optional)
        localStorage.setItem('lastOrderId', orderId);

        // DO NOT clear orderId yet - keep it for potential refresh/back navigation
        // localStorage.removeItem('orderId'); // REMOVED - causes issues

        // Redirect with orderId in URL for reliability
        setTimeout(() => {
            window.location.href = `order-success.html?orderId=${orderId}`;
        }, 1000);
    }

    // ====== 17. INITIALIZE ======
    await loadInitialData();
});
