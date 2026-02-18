const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";

const adminToken = localStorage.getItem("adminToken");

if (!adminToken) {
    window.location.href = "admin-login.html";
}

let allOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    const ordersTbody = document.getElementById('ordersTbody');
    const orderModal = document.getElementById('orderModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const closeModalIcon = document.getElementById('closeModal');
    const successToast = document.getElementById('successToast');

    // Initial Load
    fetchOrders();

    // Event Delegation for Table Actions
    if (ordersTbody) {
        ordersTbody.addEventListener('click', (e) => {
            // Traverse up in case click is on icon inside button
            const target = e.target.closest('button') || e.target;

            const orderId = target.getAttribute('data-id');
            if (target.classList.contains('view-details') && orderId) {
                showOrderDetails(orderId);
            }
        });

        ordersTbody.addEventListener('change', (e) => {
            const target = e.target;
            if (target.classList.contains('status-update')) {
                const orderId = target.getAttribute('data-id');
                const newStatus = target.value;
                confirmUpdateStatus(orderId, newStatus, target);
            }
        });
    }

    // Modal Close
    const hideModal = () => {
        orderModal.classList.remove('show');
        document.body.style.overflow = '';
    };

    if (closeDetailModal) closeDetailModal.addEventListener('click', hideModal);
    if (closeModalIcon) closeModalIcon.addEventListener('click', hideModal);

    // Close on click outside
    if (orderModal) {
        orderModal.addEventListener('click', (e) => {
            if (e.target === orderModal) hideModal();
        });
    }
});

async function fetchOrders() {
    try {
        const response = await fetch(`${API_BASE}/admin/orders`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            alert("Session expired or unauthorized. Redirecting to login...");
            localStorage.removeItem("adminToken");
            window.location.href = "admin-login.html";
            return;
        }

        const data = await response.json();
        if (data.success) {
            allOrders = data.data;
            renderOrders(allOrders);
        } else {
            console.error(data.message);
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
    }
}

function renderOrders(orders) {
    const ordersTbody = document.getElementById('ordersTbody');
    ordersTbody.innerHTML = '';

    if (orders.length === 0) {
        ordersTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No orders found</td></tr>';
        return;
    }

    orders.forEach(order => {
        const shortId = order._id.substring(order._id.length - 6).toUpperCase();
        const date = new Date(order.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const statusLower = order.status.toLowerCase();
        // Map 'paid' to 'confirmed' for UI consistency if legacy data exists
        const displayStatus = statusLower === 'paid' ? 'confirmed' : statusLower;

        // Use user populate or shipping address name
        const userName = order.user ? order.user.name : (order.shippingAddress?.fullName || 'Guest');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#MV-${shortId}</td>
            <td>${userName}</td>
            <td>${date}</td>
            <td style="font-weight: 600;">₹${order.total.toLocaleString()}</td>
            <td style="text-transform: capitalize;">${order.paymentMethod}</td>
            <td><span class="status-badge status-${displayStatus}">${capitalize(displayStatus)}</span></td>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="view-details"
                        style="background:none; border:none; color: var(--accent); cursor: pointer; font-size: 0.9rem;"
                        data-id="${order._id}">View Details</button>
                    <select class="form-control status-update" data-id="${order._id}"
                        style="width: 130px; height: 32px; padding: 0 8px; font-size: 0.8rem;">
                        <option value="pending" ${statusLower === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${statusLower === 'confirmed' || statusLower === 'paid' ? 'selected' : ''}>Confirmed</option>
                        <option value="shipped" ${statusLower === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${statusLower === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${statusLower === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </td>
        `;
        ordersTbody.appendChild(row);
    });
}

function capitalize(text) {
    if (!text) return '—';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

async function showOrderDetails(orderId) {
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server returned non-JSON response");
        }

        const data = await response.json();
        if (!data.success) return alert(data.message);

        const order = data.data;
        const shortId = order._id.substring(order._id.length - 6).toUpperCase();

        // Fill Modal Header
        document.getElementById('targetOrderId').textContent = `#MV-${shortId}`;

        // Selectors for Modal Content
        const modalBody = document.querySelector('.modal-body');
        const grid = modalBody.firstElementChild;
        const leftCol = grid.firstElementChild;
        const rightCol = grid.lastElementChild;

        // Customer Info (2nd child of left col)
        const customerInfoDiv = leftCol.children[1];

        // Product List Container (4th child of left col)
        const productListDiv = leftCol.children[3]; // <div style="display: grid; gap: 12px;">

        // Total Span (Inside 5th child of left col)
        const totalContainer = leftCol.children[4];
        const totalSpan = totalContainer ? totalContainer.querySelector('span:last-child') : null;

        // Payment Details (2nd child of right col)
        const paymentDiv = rightCol.children[1];

        // Timeline
        const timeline = rightCol.querySelector('.timeline');

        // --- Populate Data ---

        // Customer Info
        const addr = order.shippingAddress || {};
        const user = order.user || {};
        const customerName = addr.fullName || user.name || 'Guest';
        const customerPhone = addr.phone || user.phone || '—';
        const customerEmail = order.contact?.email || user.email || '—';

        if (customerInfoDiv) {
            customerInfoDiv.innerHTML = `
                <div style="background: var(--bg-dark); padding: 16px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px;">
                    <p style="margin-bottom: 8px;"><strong>Name:</strong> ${customerName}</p>
                    <p style="margin-bottom: 8px;"><strong>Email:</strong> ${customerEmail}</p>
                    <p style="margin-bottom: 8px;"><strong>Phone:</strong> ${customerPhone}</p>
                    <p><strong>Address:</strong> ${addr.street || '—'}, ${addr.city || '—'}, ${addr.state || '—'} - ${addr.pincode || '—'}${addr.landmark ? ` (Near ${addr.landmark})` : ''}</p>
                </div>
            `;
        }

        // Product List
        if (productListDiv) {
            productListDiv.innerHTML = order.items.map(item => `
                <div style="display: flex; align-items: center; gap: 16px; background: var(--bg-dark); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 12px;">
                    <img src="${item.image || 'assets/default-product.png'}" alt="${item.name}" class="product-img" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px;" onerror="this.src='assets/default-product.png'">
                    <div style="flex: 1;">
                        <p style="font-weight: 500;">${item.name}</p>
                        <p style="color: var(--text-dim); font-size: 0.85rem;">${item.quantity} × ₹${item.price.toLocaleString()}</p>
                        ${item.variant ? `<span style="font-size: 0.75rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${item.variant}</span>` : ''}
                    </div>
                    <div style="font-weight: 600;">₹${(item.price * item.quantity).toLocaleString()}</div>
                </div>
            `).join("");
        }

        // Total
        if (totalSpan) {
            totalSpan.textContent = `₹${order.total.toLocaleString()}`;
        }

        // Payment Details
        if (paymentDiv) {
            paymentDiv.innerHTML = `
                <p style="margin-bottom: 8px;">Method: <span style="color: var(--text-dim); text-transform: capitalize;">${order.paymentMethod}</span></p>
                <p>Payment Status: <span style="color: ${order.isPaid ? 'var(--status-delivered)' : 'var(--status-cancelled)'}; font-weight: 600;">${order.isPaid ? 'Paid' : 'Unpaid'}</span></p>
            `;
        }

        // Timeline (Dynamic based on status)
        const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        const currentStatusIndex = statuses.indexOf(order.status.toLowerCase() === 'paid' ? 'confirmed' : order.status.toLowerCase());

        let timelineHtml = '';
        const createdDate = new Date(order.createdAt).toLocaleString();

        // Order Placed
        timelineHtml += `
            <div class="timeline-item active">
                <div class="timeline-content">
                    <h4>Order Placed</h4>
                    <span>${createdDate}</span>
                </div>
            </div>
        `;

        // Status Flow
        if (order.status.toLowerCase() === 'cancelled') {
            timelineHtml += `
                <div class="timeline-item active">
                    <div class="timeline-content">
                        <h4 style="color: var(--status-cancelled);">Cancelled</h4>
                        <span>${new Date(order.updatedAt).toLocaleString()}</span>
                    </div>
                </div>
            `;
        } else {
            // Confirmed
            if (currentStatusIndex >= 1) {
                timelineHtml += `
                    <div class="timeline-item active">
                        <div class="timeline-content">
                            <h4>Confirmed</h4>
                        </div>
                    </div>
                `;
            }
            // Shipped
            if (currentStatusIndex >= 2) {
                timelineHtml += `
                    <div class="timeline-item active">
                        <div class="timeline-content">
                            <h4>Shipped</h4>
                        </div>
                    </div>
                `;
            }
            // Delivered
            if (currentStatusIndex >= 3) {
                timelineHtml += `
                    <div class="timeline-item active">
                        <div class="timeline-content">
                            <h4>Delivered</h4>
                            <span>${new Date(order.updatedAt).toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        }

        if (timeline) {
            timeline.innerHTML = timelineHtml;
        }

        document.getElementById('orderModal').classList.add('show');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error("Error loading order details:", error);
        alert("Failed to load order details. Check console.");
    }
}

function confirmUpdateStatus(orderId, newStatus, selectElement) {
    if (confirm(`Are you sure you want to change status to "${capitalize(newStatus)}"?`)) {
        updateOrderStatus(orderId, newStatus);
    } else {
        // Reset to previous value if known, or just re-fetch
        fetchOrders();
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        if (data.success) {
            showToast("Order status updated successfully!");
            fetchOrders();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error("Error updating status:", error);
    }
}

function showToast(message) {
    const toast = document.getElementById('successToast');
    if (!toast) return;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
