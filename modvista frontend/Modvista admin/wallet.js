const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";

// Get token
function getToken() {
    return localStorage.getItem("adminToken");
}

// API fetch helper
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
        throw new Error("Admin session expired");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
}

// Load wallet stats
async function loadWalletStats() {
    try {
        const stats = await apiFetch('/admin/wallet/stats');

        // Update metric cards
        const metrics = document.querySelectorAll('.metrics-grid .metric-card .metric-value');
        if (metrics.length >= 4) {
            metrics[0].textContent = `$${stats.totalWalletBalance.toLocaleString()}`;
            metrics[1].textContent = `$${stats.totalRefunds.toLocaleString()}`;
            metrics[2].textContent = stats.pendingRefunds;
            metrics[3].textContent = stats.failedRefunds;
        }
    } catch (err) {
        console.error('Failed to load wallet stats:', err);
    }
}

// Load transactions
let currentTransactionId = null;

async function loadTransactions(filters = {}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters.type) queryParams.append('type', filters.type);
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.paymentMethod) queryParams.append('paymentMethod', filters.paymentMethod);
        if (filters.search) queryParams.append('search', filters.search);

        queryParams.append('limit', '50');

        const data = await apiFetch(`/admin/wallet/transactions?${queryParams}`);
        const tbody = document.querySelector('.table-wrapper tbody');

        if (!tbody) return;

        if (!data.transactions || data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 40px;">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = data.transactions.map(txn => {
            const date = new Date(txn.createdAt);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const formattedTime = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusClass = getStatusClass(txn.status);
            const statusText = txn.status.charAt(0).toUpperCase() + txn.status.slice(1);
            const typeColor = txn.type === 'refund' ? 'var(--status-delivered)' :
                txn.type === 'credit' ? 'var(--status-delivered)' : 'var(--text-dim)';

            return `
                <tr data-txn-id="${txn._id}">
                    <td style="font-family: monospace;">${txn._id.slice(-6).toUpperCase()}</td>
                    <td>
                        <div style="font-weight: 500;">${txn.user?.name || 'Unknown'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim);">${txn.user?.email || 'N/A'}</div>
                    </td>
                    <td>${txn.relatedOrder ? `<a href="orders.html" style="color: var(--accent); text-decoration: none;">#${txn.relatedOrder._id.slice(-4).toUpperCase()}</a>` : 'N/A'}</td>
                    <td><span style="color: ${typeColor}; font-weight: 500;">${txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}</span></td>
                    <td style="font-weight: 600;">$${txn.amount.toFixed(2)}</td>
                    <td>${txn.paymentMethod || 'Wallet'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div style="font-size: 0.85rem;">${formattedDate}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim);">${formattedTime}</div>
                    </td>
                    <td>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            ${txn.status === 'failed' ? `
                                <i class="fas fa-redo-alt retry-refund" data-txn-id="${txn._id}"
                                    style="cursor: pointer; color: var(--accent);" title="Retry Refund"></i>
                            ` : ''}
                            <i class="fas fa-info-circle view-txn" data-txn-id="${txn._id}"
                                style="cursor: pointer; color: var(--text-dim);" title="View Details"></i>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners
        attachTransactionEventListeners();

    } catch (err) {
        console.error('Failed to load transactions:', err);
        const tbody = document.querySelector('.table-wrapper tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red; padding: 40px;">Error loading transactions</td></tr>';
        }
    }
}

function getStatusClass(status) {
    const statusMap = {
        'completed': 'status-delivered',
        'pending': 'status-pending',
        'failed': 'status-cancelled'
    };
    return statusMap[status.toLowerCase()] || 'status-pending';
}

// Attach event listeners to transaction buttons
function attachTransactionEventListeners() {
    // View transaction details
    document.querySelectorAll('.view-txn').forEach(btn => {
        btn.addEventListener('click', () => {
            const txnId = btn.getAttribute('data-txn-id');
            viewTransactionDetails(txnId);
        });
    });

    // Retry failed refund
    document.querySelectorAll('.retry-refund').forEach(btn => {
        btn.addEventListener('click', () => {
            const txnId = btn.getAttribute('data-txn-id');
            retryRefund(txnId);
        });
    });
}

// View transaction details (simplified - just show alert for now)
function viewTransactionDetails(txnId) {
    const row = document.querySelector(`tr[data-txn-id="${txnId}"]`);
    if (!row) return;

    const cells = row.cells;
    const details = `
Transaction ID: ${cells[0].textContent}
User: ${cells[1].querySelector('div').textContent}
Type: ${cells[3].textContent}
Amount: ${cells[4].textContent}
Status: ${cells[6].textContent}
Date: ${cells[7].querySelector('div').textContent}
    `.trim();

    alert(details);
}

// Retry failed refund
async function retryRefund(txnId) {
    if (!confirm('Are you sure you want to retry this refund?')) {
        return;
    }

    try {
        await apiFetch(`/admin/wallet/retry/${txnId}`, {
            method: 'POST'
        });

        showToast('Refund retried successfully!');

        // Reload transactions
        setTimeout(() => {
            loadTransactions();
            loadWalletStats();
        }, 1000);

    } catch (err) {
        console.error('Failed to retry refund:', err);
        alert('Failed to retry refund: ' + err.message);
    }
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById('successToast');
    const toastMsg = document.getElementById('toastMessage');
    if (toast && toastMsg) {
        toastMsg.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadWalletStats();
    loadTransactions();

    // Search functionality
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadTransactions({ search: e.target.value });
            }, 500);
        });
    }

    // Filter functionality (simplified - just reload on change)
    const filterSelects = document.querySelectorAll('.section-container select');
    filterSelects.forEach(select => {
        select.addEventListener('change', () => {
            const filters = {};
            // You can enhance this to read all filter values
            loadTransactions(filters);
        });
    });
});
