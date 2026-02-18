const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";

// --- Helpers ---
function getToken() {
    return localStorage.getItem("adminToken");
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "admin-login.html";
        throw new Error("Admin session expired / not authorized");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
}

// --- Load Dashboard Data ---
async function loadDashboardStats() {
    try {
        const stats = await apiFetch('/admin/dashboard/stats');

        // Update metric cards
        document.querySelector('.metrics-grid .metric-card:nth-child(1) .metric-value').textContent = stats.totalUsers.toLocaleString();
        document.querySelector('.metrics-grid .metric-card:nth-child(2) .metric-value').textContent = stats.totalOrders.toLocaleString();
        document.querySelector('.metrics-grid .metric-card:nth-child(3) .metric-value').textContent = `$${stats.totalRevenue.toLocaleString()}`;
        document.querySelector('.metrics-grid .metric-card:nth-child(4) .metric-value').textContent = stats.activeProducts.toLocaleString();

    } catch (err) {
        console.error('Failed to load dashboard stats:', err);
    }
}

async function loadRecentOrders() {
    try {
        const orders = await apiFetch('/admin/dashboard/recent-orders?limit=5');
        const tbody = document.querySelector('.table-wrapper tbody');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No recent orders</td></tr>';
            return;
        }

        orders.forEach(order => {
            const statusClass = getStatusClass(order.status);
            const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
            const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${order.shortId || 'N/A'}</td>
                <td>${order.user?.name || 'Unknown User'}</td>
                <td>${orderDate}</td>
                <td>$${order.totalAmount.toLocaleString()}</td>
                <td>${order.paymentMethod || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button onclick="window.location.href='orders.html'" 
                        style="background:none; border:none; color: var(--accent); cursor: pointer;">View</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load recent orders:', err);
        const tbody = document.querySelector('.table-wrapper tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading orders</td></tr>';
        }
    }
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'confirmed': 'status-confirmed',
        'shipped': 'status-shipped',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
    };
    return statusMap[status.toLowerCase()] || 'status-pending';
}

// --- Initialize Dashboard ---
document.addEventListener('DOMContentLoaded', () => {
    // Load dashboard data
    loadDashboardStats();
    loadRecentOrders();

    // Setup quick action buttons
    const quickActions = document.querySelectorAll('.quick-actions .action-btn');
    if (quickActions.length >= 4) {
        quickActions[0].addEventListener('click', () => window.location.href = 'products.html');
        quickActions[1].addEventListener('click', () => window.location.href = 'offers.html');
        quickActions[2].addEventListener('click', () => window.location.href = 'coupons.html');
        quickActions[3].addEventListener('click', () => window.location.href = 'orders.html');
    }
});
