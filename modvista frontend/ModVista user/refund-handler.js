/* ========================================
   MODVISTA WALLET REFUND HANDLER
   Order Cancellation & Refund Logic
   ======================================== */

// Refund processing state
let isRefundInProgress = false;

/* ========================================
   MAIN REFUND FUNCTION
   ======================================== */

function processOrderRefund(order) {
    // Prevent duplicate refunds
    if (isRefundInProgress || order.refundStatus === 'completed') {
        showToast('Refund already processed', 'error');
        return;
    }

    if (!order.paymentBreakdown) {
        showToast('Invalid order data', 'error');
        return;
    }

    isRefundInProgress = true;

    const { walletPaid = 0, onlinePaid = 0, codAmount = 0 } = order.paymentBreakdown;

    // Check eligibility
    if (walletPaid === 0 && onlinePaid === 0) {
        // COD only - no refund applicable
        showRefundNotApplicable();
        isRefundInProgress = false;
        return;
    }

    // Disable order actions
    disableOrderActions(order.id);

    // Show loading state
    showRefundLoading();

    // Process refund after short delay (simulate processing)
    setTimeout(() => {
        // Step 1: Refund to wallet (instant)
        if (walletPaid > 0) {
            refundToWallet(walletPaid);
        }

        // Step 2: Initiate online refund (simulated)
        let onlineRefundStatus = null;
        if (onlinePaid > 0) {
            onlineRefundStatus = initiateOnlineRefund(onlinePaid);
        }

        // Step 3: Update order status
        updateOrderRefundStatus(order.id, {
            walletRefunded: walletPaid,
            onlineRefunded: onlinePaid,
            onlineRefundStatus: onlineRefundStatus,
            refundDate: new Date().toISOString(),
            refundId: generateRefundId()
        });

        // Step 4: Show refund confirmation
        setTimeout(() => {
            hideRefundLoading();
            showRefundConfirmation({
                walletRefund: walletPaid,
                onlineRefund: onlinePaid,
                totalRefund: walletPaid + onlinePaid,
                refundId: order.refundId || generateRefundId(),
                timestamp: new Date()
            });

            isRefundInProgress = false;
        }, 1500); // Animation duration

    }, 500);
}

/* ========================================
   WALLET REFUND (INSTANT)
   ======================================== */

function refundToWallet(amount) {
    // Get current wallet balance
    let walletBalance = parseFloat(localStorage.getItem('walletBalance') || '0');

    // Add refund amount
    const newBalance = walletBalance + amount;

    // Save to localStorage
    localStorage.setItem('walletBalance', newBalance.toString());

    // Trigger wallet update animation
    animateWalletRefund(walletBalance, newBalance);

    // Update wallet badge in navbar if present
    updateWalletBadge(newBalance);
}

/* ========================================
   ONLINE PAYMENT REFUND (SIMULATED)
   ======================================== */

function initiateOnlineRefund(amount) {
    // In real app, this would call payment gateway API
    // For simulation, we just return a processing status

    return {
        status: 'processing',
        amount: amount,
        estimatedDays: '3-5 business days',
        message: 'Refund initiated to original payment method'
    };
}

/* ========================================
   REFUND ANIMATIONS
   ======================================== */

function animateWalletRefund(oldBalance, newBalance) {
    // Trigger rupee trail animation
    createRupeeTrail();

    // Wallet glow effect
    const walletIcon = document.querySelector('.wallet-icon-wrapper');
    if (walletIcon) {
        walletIcon.classList.add('wallet-glow');
        setTimeout(() => {
            walletIcon.classList.remove('wallet-glow');
        }, 2000);
    }

    // Count-up animation
    animateCountUp(oldBalance, newBalance);
}

function createRupeeTrail() {
    const container = document.body;

    // Create 5-8 animated rupee symbols
    const count = Math.floor(Math.random() * 4) + 5;

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const rupee = document.createElement('div');
            rupee.className = 'rupee-trail';
            rupee.innerHTML = '₹';
            rupee.style.left = `${Math.random() * 100}%`;
            rupee.style.animationDelay = `${i * 0.1}s`;

            container.appendChild(rupee);

            // Remove after animation
            setTimeout(() => {
                rupee.remove();
            }, 1500);
        }, i * 100);
    }
}

function animateCountUp(start, end) {
    const walletBalanceEl = document.getElementById('wallet-balance-display');
    if (!walletBalanceEl) return;

    const duration = 1000;
    const steps = 30;
    const increment = (end - start) / steps;
    let current = start;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        current += increment;

        if (step >= steps) {
            current = end;
            clearInterval(interval);

            // Add success checkmark
            walletBalanceEl.classList.add('updated-success');
            setTimeout(() => {
                walletBalanceEl.classList.remove('updated-success');
            }, 2000);
        }

        walletBalanceEl.textContent = `₹${Math.round(current).toLocaleString()}`;
    }, duration / steps);
}

/* ========================================
   REFUND CONFIRMATION UI
   ======================================== */

function showRefundConfirmation(refundData) {
    const { walletRefund, onlineRefund, totalRefund, refundId, timestamp } = refundData;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'refund-modal active';
    modal.id = 'refund-confirmation-modal';

    const hasOnlineRefund = onlineRefund > 0;

    modal.innerHTML = `
        <div class="refund-modal-content">
            <div class="refund-success-icon">
                <div class="checkmark-circle">
                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="checkmark-circle-path" cx="26" cy="26" r="25" fill="none"/>
                        <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                </div>
            </div>
            
            <h2 class="refund-title">Refund ${hasOnlineRefund ? 'Initiated' : 'Completed'}</h2>
            <p class="refund-subtitle">Order cancelled successfully</p>
            
            <div class="refund-breakdown">
                <div class="refund-row total">
                    <span>Total Refund Amount</span>
                    <span class="refund-amount">₹${totalRefund.toLocaleString()}</span>
                </div>
                
                ${walletRefund > 0 ? `
                <div class="refund-row wallet">
                    <div>
                        <i class="fas fa-wallet"></i> Wallet Refund
                        <span class="status-badge instant">Instant</span>
                    </div>
                    <span class="amount">₹${walletRefund.toLocaleString()}</span>
                </div>
                ` : ''}
                
                ${hasOnlineRefund ? `
                <div class="refund-row online">
                    <div>
                        <i class="fas fa-credit-card"></i> Online Payment Refund
                        <span class="status-badge processing">Processing</span>
                    </div>
                    <span class="amount">₹${onlineRefund.toLocaleString()}</span>
                </div>
                <p class="refund-note">
                    <i class="fas fa-info-circle"></i>
                    Online refund will be credited to your original payment method in 3–5 business days
                </p>
                ` : ''}
            </div>
            
            <div class="refund-details">
                <div class="detail-row">
                    <span>Refund ID</span>
                    <span class="ref-id">${refundId}</span>
                </div>
                <div class="detail-row">
                    <span>Timestamp</span>
                    <span>${formatTimestamp(timestamp)}</span>
                </div>
            </div>
            
            <div class="refund-actions">
                <button class="secondary-refund-btn" onclick="navigateToWallet()">
                    <i class="fas fa-wallet"></i> View Wallet
                </button>
                <button class="primary-refund-btn" onclick="navigateToOrders()">
                    <i class="fas fa-box"></i> Order History
                </button>
            </div>
            
            <button class="close-refund-modal" onclick="closeRefundModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(modal);
}

function showRefundNotApplicable() {
    showToast('No refund applicable for COD orders', 'normal');
}

/* ========================================
   UI HELPERS
   ======================================== */

function showRefundLoading() {
    const loader = document.createElement('div');
    loader.id = 'refund-loader';
    loader.className = 'refund-loader active';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>Processing refund...</p>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideRefundLoading() {
    const loader = document.getElementById('refund-loader');
    if (loader) {
        loader.classList.remove('active');
        setTimeout(() => loader.remove(), 300);
    }
}

function disableOrderActions(orderId) {
    const cancelBtn = document.querySelector(`[data-order-id="${orderId}"] .cancel-order-btn`);
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Refunding...';
    }
}

function updateOrderRefundStatus(orderId, refundInfo) {
    // Update order in localStorage or session
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex !== -1) {
        orders[orderIndex].refundStatus = 'completed';
        orders[orderIndex].refundInfo = refundInfo;
        orders[orderIndex].status = 'cancelled';
        localStorage.setItem('orders', JSON.stringify(orders));
    }
}

function updateWalletBadge(balance) {
    const badges = document.querySelectorAll('.wallet-balance-badge');
    badges.forEach(badge => {
        badge.textContent = `₹${Math.round(balance).toLocaleString()}`;
    });
}

/* ========================================
   NAVIGATION
   ======================================== */

window.navigateToWallet = function () {
    window.location.href = 'wallet.html';
};

window.navigateToOrders = function () {
    window.location.href = 'orders.html';
};

window.closeRefundModal = function () {
    const modal = document.getElementById('refund-confirmation-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
};

/* ========================================
   UTILITIES
   ======================================== */

function generateRefundId() {
    return 'REF' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function formatTimestamp(date) {
    const d = new Date(date);
    return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'normal') {
    const toast = document.createElement('div');
    toast.className = 'cart-toast show';

    const iconClass = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${iconClass}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ========================================
   GLOBAL EXPORTS
   ======================================== */

window.processOrderRefund = processOrderRefund;
