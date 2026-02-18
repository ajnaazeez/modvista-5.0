document.addEventListener('DOMContentLoaded', () => {
    const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
    const localApiBase = getApiBase();

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const ordersContainer = document.getElementById('orders-container');
    const emptyState = document.getElementById('empty-state');
    const filterSelect = document.getElementById('order-filter');
    const sortSelect = document.getElementById('order-sort');

    let allOrders = [];

    // ====== 1. FETCH ORDERS ======
    async function fetchOrders() {
        try {
            const data = await window.ModVistaAPI.apiCall('/orders/my');

            if (data && data.success) {
                allOrders = data.data;
                applyFiltersAndSort();
            } else {
                console.error('Failed to fetch orders:', data ? data.message : 'Unknown error');
                renderOrders([]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            ordersContainer.innerHTML = '<div class="error-state"><p>Failed to load orders. Please try again.</p></div>';
        }
    }

    // ====== 2. RENDER ORDERS ======
    function renderOrders(orders) {
        ordersContainer.innerHTML = '';

        if (!orders || orders.length === 0) {
            ordersContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        ordersContainer.style.display = 'grid'; // Changed to grid for layout
        emptyState.style.display = 'none';

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';

            const statusRaw = (order.status || 'pending').toLowerCase();
            const statusClass = statusRaw; // Already lowercase
            const dateObj = new Date(order.createdAt);
            const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

            const shortId = order._id.substring(order._id.length - 8).toUpperCase();

            // Items Logic
            const itemsCount = order.items ? order.items.length : 0;
            const shownItems = order.items ? order.items.slice(0, 3) : [];
            const moreItemsCount = itemsCount > 3 ? itemsCount - 3 : 0;

            // Image Path Helper
            const getImagePath = (img) => {
                if (!img) return 'assets/default-product.png';
                if (img.startsWith('http')) return img;

                // Derive backend root (e.g., http://localhost:5000 from http://localhost:5000/api)
                const apiBase = window.ModVistaAPI?.API_BASE || "http://localhost:5000/api";
                const backendRoot = apiBase.replace(/\/api\/?$/, '');

                if (img.startsWith('uploads/')) return `${backendRoot}/${img}`;
                if (img.startsWith('assets/')) return img;
                return `assets/${img}`;
            };

            // AI Preview Availablity (Mock logic or check if any item is compatible)
            // For now, let's assume if status is delivered, AI preview is available 
            // (You might want properly logical field from backend later)
            const aiPreviewAvailable = order.status === 'delivered';

            card.innerHTML = `
                <div class="order-card-header">
                    <div class="order-meta-info" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">ID</small>
                            <span class="order-id-tag" style="font-weight: bold; color: #ff1f1f;">#${shortId}</span>
                        </div>
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Date</small>
                            <span style="color: #eee;">${dateFormatted}</span>
                        </div>
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Status</small>
                            <span class="order-status-badge status-${statusClass}" style="display: inline-flex; align-items: center; gap: 5px;">
                                <span class="status-dot"></span>
                                ${capitalize(order.status)}
                            </span>
                        </div>
                        <div class="meta-item" style="margin-left: auto;">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Total</small>
                            <span class="header-total" style="font-weight: 800; color: white; font-size: 1.1rem;">$${order.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="order-card-body" style="padding: 20px; display: block;">
                    <div class="product-info-section">
                        <div class="product-previews" style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                            ${itemsCount === 1 ? `
                                <div class="single-item-preview" style="display: flex; align-items: center; gap: 15px;">
                                    <img src="${getImagePath(shownItems[0].image)}" 
                                         alt="${shownItems[0].name}" 
                                         class="thumb-image" 
                                         style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #333;"
                                         onerror="this.src='assets/default-product.png'">
                                    <div class="single-item-header">
                                        <span class="item-name-prominent" style="font-weight: 600; color: #fff; display: block;">${shownItems[0].name}</span>
                                        <span class="item-variant-label" style="font-size: 0.8rem; color: #888;">${shownItems[0].variant || 'Standard'}</span>
                                    </div>
                                </div>
                            ` : `
                                ${shownItems.map(item => `
                                    <img src="${getImagePath(item.image)}" 
                                         alt="${item.name}" 
                                         class="thumb-image" 
                                         style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #333;"
                                         onerror="this.src='assets/default-product.png'">
                                `).join('')}
                                ${moreItemsCount > 0 ? `<span class="more-items" style="color: #888; font-size: 0.9rem;">+${moreItemsCount} more items</span>` : ''}
                            `}
                        </div>
                    </div>
                </div>
                <div class="order-card-footer">
                    ${getActionButtons(order._id, order.status, aiPreviewAvailable)}
                </div>
            `;
            ordersContainer.appendChild(card);
        });
    }

    // ====== 3. HELPER FUNCTIONS ======
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function getActionButtons(orderId, status, aiAvailable) {
        // We can pass orderId via URL to view details
        let buttons = `
            <a href="order-details.html?id=${orderId}" class="action-btn btn-view" 
               style="background: rgba(255, 31, 31, 0.1); border: 1px solid rgba(255, 31, 31, 0.3); color: #fff; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-info-circle" style="color: #ff1f1f; font-size: 0.9rem;"></i> Details
            </a>`;

        const s = status.toLowerCase();

        if (s === 'shipped') {
            // Placeholder track link
            buttons += `<a href="order-tracking.html?id=${orderId}" class="action-btn btn-secondary"><i class="fas fa-truck"></i> Track Order</a>`;
        } else if (s === 'pending' || s === 'confirmed') {
            buttons += `<a href="order-cancel.html?id=${orderId}" class="action-btn btn-secondary"><i class="fas fa-times"></i> Cancel Order</a>`;
        } else if (s === 'delivered') {
            // Reorder could just link to shop for now
            buttons += `<a href="shop.html" class="action-btn btn-secondary"><i class="fas fa-redo"></i> Buy Again</a>`;
        }

        if (aiAvailable) {
            // Assuming AI preview takes an order ID or product ID
            buttons += `<a href="ai-preview.html?orderId=${orderId}" class="action-btn btn-secondary ai-btn">View AI Preview</a>`;
        }

        return buttons;
    }

    // ====== 4. FILTER & SORT LOGIC ======
    function applyFiltersAndSort() {
        const filterValue = filterSelect.value;
        const sortValue = sortSelect.value;

        let filtered = [...allOrders];

        // Filter
        if (filterValue !== 'all') {
            if (filterValue === '30days') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                filtered = filtered.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
            } else {
                filtered = filtered.filter(o => (o.status || '').toLowerCase() === filterValue);
            }
        }

        // Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortValue === 'newest' ? dateB - dateA : dateA - dateB;
        });

        renderOrders(filtered);
    }

    // Listeners
    if (filterSelect) filterSelect.addEventListener('change', applyFiltersAndSort);
    if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndSort);

    // Init
    fetchOrders();
});
