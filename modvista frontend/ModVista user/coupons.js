const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
const localApiBase = getApiBase();
const token = localStorage.getItem("token");

document.addEventListener('DOMContentLoaded', () => {
    fetchCoupons();

    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panes
            tabPanes.forEach(p => p.classList.remove('active'));
            const targetPane = document.getElementById(`${tabId}-tab`);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    const applyBtn = document.getElementById('apply-manual-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', handleManualApply);
    }

    // Check for applied coupon in localStorage
    renderAppliedCoupon();
});

async function fetchCoupons() {
    try {
        console.log("Fetching coupons from:", `${localApiBase}/coupons`);
        const response = await fetch(`${localApiBase}/coupons`);
        const data = await response.json();
        console.log("Coupons data:", data);

        if (data.success) {
            const coupons = data.data;
            const available = coupons.filter(c => c.isActive && !c.isExpired);
            const expired = coupons.filter(c => !c.isActive || c.isExpired);

            renderCouponGrid(available, 'available-coupons-grid');
            renderCouponGrid(expired, 'expired-coupons-grid');
        }
    } catch (error) {
        console.error("Error fetching coupons:", error);
    }
}

function renderCouponGrid(coupons, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (coupons.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">No coupons found.</p>';
        return;
    }

    grid.innerHTML = coupons.map(coupon => {
        const isExpired = coupon.isExpired || !coupon.isActive;
        const discountText = coupon.discType === 'percentage' ? `${coupon.discValue}% OFF` : `₹${coupon.discValue} FLAT`;
        const dateText = coupon.expiry
            ? `Valid till ${new Date(coupon.expiry).toLocaleDateString()}`
            : "No expiry date";

        // Premium Badge Logic
        let badge = '';
        if (!isExpired) {
            if (coupon.discValue >= 20 || (coupon.discType === 'flat' && coupon.discValue >= 500)) {
                badge = '<span class="coupon-badge best-deal">Best Deal</span>';
            } else if (new Date() - new Date(coupon.createdAt) < 7 * 24 * 60 * 60 * 1000) {
                badge = '<span class="coupon-badge new">New</span>';
            }
        } else {
            badge = '<span class="expired-label">Expired</span>';
        }

        return `
            <div class="coupon-card ${isExpired ? 'expired' : ''}">
                ${badge}
                <div class="coupon-code-section">
                    <span class="coupon-code-text">${coupon.code}</span>
                    ${!isExpired ? `
                        <button class="copy-code-btn" onclick="copyCoupon('${coupon.code}')">
                            <i class="far fa-copy"></i> COPY
                        </button>` : ''}
                </div>
                <div class="coupon-discount">${discountText}</div>
                <div class="coupon-details">
                    <p>${coupon.minOrder > 0 ? `• Min. order ₹${coupon.minOrder.toLocaleString()}` : '• No minimum order'}</p>
                    <p>• Applicable on all premium parts</p>
                </div>
                <div class="coupon-validity">${dateText}</div>
                <button class="apply-coupon-btn" 
                        ${isExpired ? 'disabled' : `onclick="applyThisCoupon('${coupon.code}')"`}>
                    ${isExpired ? 'Not Available' : 'Apply Now'}
                </button>
            </div>
        `;
    }).join('');
}

async function applyThisCoupon(code) {
    const input = document.getElementById('manual-coupon-input');
    if (input) {
        input.value = code;
        handleManualApply();
    }
}


function renderAppliedCoupon() {
    const applied = localStorage.getItem('appliedCoupon');
    const pane = document.getElementById('applied-tab');
    if (!pane) return;

    if (applied) {
        const coupon = JSON.parse(applied);
        pane.innerHTML = `
            <div class="applied-coupon-card">
                <div class="applied-header">
                    <i class="fas fa-check-circle" style="color: #4cd137;"></i>
                    <h3>Coupon Applied!</h3>
                </div>
                <div class="coupon-details">
                    <span class="code-badge">${coupon.code}</span>
                    <p>You've unlocked this discount. Head to checkout to see your savings.</p>
                </div>
                <div class="applied-actions">
                    <button class="remove-coupon-btn" onclick="removeCoupon()">Remove Coupon</button>
                    <a href="checkout.html" class="primary-btn">Go to Checkout</a>
                </div>
            </div>
        `;
    } else {
        pane.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt"></i>
                <p>No coupon applied yet. Browse available coupons and apply one!</p>
            </div>
        `;
    }
}

function removeCoupon() {
    localStorage.removeItem('appliedCoupon');
    renderAppliedCoupon();
}

function copyCoupon(code) {
    navigator.clipboard.writeText(code).then(() => {
        const msgEl = document.getElementById('validation-message');
        msgEl.textContent = `Code ${code} copied! Paste it in the input above.`;
        msgEl.style.color = "var(--accent)";
        setTimeout(() => msgEl.textContent = "", 3000);
    });
}

async function handleManualApply() {
    const codeInput = document.getElementById('manual-coupon-input');
    const msgEl = document.getElementById('validation-message');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) return;

    if (!token) {
        alert("Please login to apply coupons");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(`${localApiBase}/coupons/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code })
        });
        const data = await response.json();

        if (data.success) {
            msgEl.textContent = `Success! ${data.message}.`;
            msgEl.style.color = "#4cd137";
            localStorage.setItem('appliedCoupon', JSON.stringify(data.data));
            renderAppliedCoupon();
            // Optional: switch to applied tab
            document.querySelector('[data-tab="applied"]').click();
        } else {
            msgEl.textContent = data.message;
            msgEl.style.color = "#ff1f1f";
        }
    } catch (error) {
        console.error("Error applying coupon:", error);
    }
}
