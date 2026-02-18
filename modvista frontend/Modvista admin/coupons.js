
const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";
const token = localStorage.getItem("adminToken");

if (!token) {
    window.location.href = "admin-login.html";
}

let editCouponId = null;
let allCoupons = [];

document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const createNewBtn = document.getElementById('createNewBtn');
    const couponModal = document.getElementById('couponModal');

    createNewBtn.addEventListener('click', () => {
        resetCouponForm();
        couponModal.classList.add('show');
    });

    document.querySelectorAll('.close-modal, #cancelCoupon').forEach(btn => {
        btn.addEventListener('click', () => {
            couponModal.classList.remove('show');
        });
    });

    // Initial load
    fetchCoupons();

    // Form submissions
    document.getElementById('couponForm').addEventListener('submit', handleCouponSubmit);

    // Event delegation for dynamic rows
    document.getElementById('couponsTbody').addEventListener('click', handleCouponActions);
});

async function fetchCoupons() {
    try {
        const res = await fetch(`${API_BASE}/admin/coupons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allCoupons = data.data;
            renderCoupons();
        } else if (res.status === 401 || res.status === 403) {
            handleAuthError();
        }
    } catch (err) {
        console.error(err);
    }
}

function renderCoupons() {
    const tbody = document.getElementById('couponsTbody');
    const now = new Date();

    tbody.innerHTML = allCoupons.map(coupon => {
        const discountText = coupon.discType === 'percentage' ? `${coupon.discValue}% Off` : `₹${coupon.discValue} Flat`;
        const isExpired = coupon.expiry && new Date(coupon.expiry) < now;
        const expiryText = isExpired ? '<span style="color: var(--status-cancelled);">Expired</span>' : (coupon.expiry ? new Date(coupon.expiry).toLocaleDateString() : 'N/A');
        const usageText = `<span style="color: var(--status-delivered); font-weight: 500;">${coupon.usedCount}</span> / ${coupon.usageLimit || '∞'}`;

        return `
            <tr>
                <td style="font-family: monospace; font-weight: 700; color: var(--accent); font-size: 1rem;">${coupon.code}</td>
                <td style="font-weight: 500;">${discountText}</td>
                <td style="color: var(--text-dim);">₹${coupon.minOrder.toLocaleString()}</td>
                <td style="color: var(--text-dim);">${coupon.maxDiscount ? `₹${coupon.maxDiscount.toLocaleString()}` : 'N/A'}</td>
                <td style="font-size: 0.85rem;">${expiryText}</td>
                <td>${usageText}</td>
                <td><span class="status-badge status-${coupon.isActive && !isExpired ? 'active' : 'disabled'}">${coupon.isActive && !isExpired ? 'Active' : (isExpired ? 'Expired' : 'Inactive')}</span></td>
                <td>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <i class="fas fa-pencil-alt edit-coupon" data-id="${coupon._id}" style="cursor: pointer; color: var(--text-dim);" title="Edit"></i>
                        <label class="switch">
                            <input type="checkbox" class="toggle-coupon" data-id="${coupon._id}" ${coupon.isActive ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <i class="fas fa-trash-alt delete-coupon" data-id="${coupon._id}" style="cursor: pointer; color: var(--status-cancelled);" title="Delete"></i>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleCouponSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
        code: formData.get('code').toUpperCase(),
        discType: formData.get('disc_type'),
        discValue: Number(formData.get('disc_value')),
        minOrder: Number(formData.get('min_order')),
        usageLimit: formData.get('usage_limit') ? Number(formData.get('usage_limit')) : null,
        expiry: formData.get('expiry') || null
    };

    const url = editCouponId ? `${API_BASE}/admin/coupons/${editCouponId}` : `${API_BASE}/admin/coupons`;
    const method = editCouponId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Coupon ${editCouponId ? 'updated' : 'created'} successfully!`);
            document.getElementById('couponModal').classList.remove('show');
            fetchCoupons();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleCouponActions(e) {
    const target = e.target;
    const id = target.getAttribute('data-id');

    if (target.classList.contains('edit-coupon')) {
        const coupon = allCoupons.find(c => c._id === id);
        fillCouponForm(coupon);
    } else if (target.classList.contains('toggle-coupon')) {
        toggleStatus(`${API_BASE}/admin/coupons/${id}/toggle`, fetchCoupons);
    } else if (target.classList.contains('delete-coupon')) {
        if (confirm('Are you sure you want to delete this coupon?')) {
            deleteResource(`${API_BASE}/admin/coupons/${id}`, fetchCoupons);
        }
    }
}

async function toggleStatus(url, reloadFn) {
    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message);
            reloadFn();
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteResource(url, reloadFn) {
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast("Resource deleted successfully");
            reloadFn();
        }
    } catch (err) {
        console.error(err);
    }
}

function handleAuthError() {
    alert("Session expired. Please login again.");
    localStorage.removeItem("adminToken");
    window.location.href = "admin-login.html";
}

function showToast(msg) {
    const toast = document.getElementById('successToast');
    const text = document.getElementById('toastMessage');
    text.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function fillCouponForm(coupon) {
    editCouponId = coupon._id;
    const form = document.getElementById('couponForm');
    form.code.value = coupon.code;
    form.disc_type.value = coupon.discType;
    form.disc_value.value = coupon.discValue;
    form.min_order.value = coupon.minOrder;
    form.usage_limit.value = coupon.usageLimit || '';
    form.expiry.value = coupon.expiry ? coupon.expiry.split('T')[0] : '';

    document.getElementById('couponModalTitle').textContent = 'Edit Coupon Code';
    document.getElementById('saveCouponBtn').disabled = false;
    document.getElementById('couponModal').classList.add('show');
}

function resetCouponForm() {
    editCouponId = null;
    document.getElementById('couponForm').reset();
    document.getElementById('couponModalTitle').textContent = 'Create Coupon Code';
}

document.getElementById('couponForm').addEventListener('input', () => {
    const code = document.querySelector('[name="code"]').value;
    const discValue = document.querySelector('[name="disc_value"]').value;
    document.getElementById('saveCouponBtn').disabled = !(code && discValue);
});
