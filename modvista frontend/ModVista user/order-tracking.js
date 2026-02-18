document.addEventListener('DOMContentLoaded', async () => {
    const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
    const localApiBase = getApiBase();

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Get Order ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    const orderIdEl = document.getElementById('order-id');
    const orderDateEl = document.getElementById('order-date');
    const statusTextEl = document.getElementById('status-text');
    const statusBadgeEl = document.getElementById('order-status-badge');
    const etaDateEl = document.getElementById('eta-date');
    const timelineContainer = document.querySelector('.tracking-timeline');
    const statusLogContainer = document.getElementById('status-log');
    const currentCityEl = document.getElementById('current-city');

    if (!orderId) {
        renderSearchForm();
        return;
    }

    // Fetch Order Data
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`${localApiBase}/orders/${orderId}?v=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        if (data.success) {
            updateTrackingUI(data.data);
            fetchSidebarProfile();
        } else {
            alert("Could not load tracking info. Please check the Order ID.");
            renderSearchForm(); // Fallback to search if ID invalid
        }

    } catch (error) {
        console.error("Tracking Error:", error);
        alert("An error occurred while tracking the order.");
    }

    async function fetchSidebarProfile() {
        try {
            const resp = await fetch(`${localApiBase}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const pData = await resp.json();
            if (pData.success) {
                const user = pData.user;
                if (document.getElementById('profileName')) document.getElementById('profileName').textContent = user.fullName || user.name;
                if (document.getElementById('profileEmail')) document.getElementById('profileEmail').textContent = user.email;
                if (document.getElementById('profileAvatar') && user.avatar) {
                    let avatarSrc = user.avatar;
                    if (avatarSrc.startsWith('uploads/')) {
                        avatarSrc = `${localApiBase.replace('/api', '')}/${avatarSrc}`;
                    }
                    document.getElementById('profileAvatar').src = avatarSrc;
                }
            }
        } catch (err) {
            console.error("Sidebar profile fetch error:", err);
        }
    }
    renderSearchForm();

    function renderSearchForm() {
        // Hide tracking UI
        const trackingMain = document.querySelector('.tracking-layout');
        if (trackingMain) trackingMain.style.display = 'none';

        const trackingHeader = document.querySelector('.order-tracking-header');
        if (trackingHeader) trackingHeader.style.display = 'none';

        // Inject Search Form
        const container = document.querySelector('.container');
        const searchDiv = document.createElement('div');
        searchDiv.className = 'card-box';
        searchDiv.style.maxWidth = '500px';
        searchDiv.style.margin = '40px auto';
        searchDiv.style.textAlign = 'center';
        searchDiv.style.padding = '40px';

        searchDiv.innerHTML = `
            <i class="fas fa-search-location" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 20px;"></i>
            <h2 style="margin-bottom: 10px;">Track Your Order</h2>
            <p style="color: var(--text-secondary); margin-bottom: 25px;">Enter your Order ID to see real-time status updates.</p>
            <div style="display: flex; gap: 10px; max-width: 400px; margin: 0 auto;">
                <input type="text" id="track-input" placeholder="Order ID (e.g. MV-1234)" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--bg-dark); color: white;">
                <button id="track-btn" class="primary-btn" style="width: auto;">Track</button>
            </div>
            <p style="margin-top: 20px; font-size: 0.9rem; color: var(--text-muted);">
                Don't have your ID? <a href="orders.html" style="color: var(--accent-color);">View My Orders</a>
            </p>
        `;

        container.appendChild(searchDiv);

        document.getElementById('track-btn').addEventListener('click', () => {
            const val = document.getElementById('track-input').value.trim();
            if (val) {
                // If ID starts with MV- or #, strip it? Backend expects Mongo ID usually.
                // But typically users might see friendly ID. Currently we use MongoID in URL.
                // If user types ID, they might copy MongoID from URL or Order History.
                // Let's assume they copy paste functionality for now.
                window.location.href = `order-tracking.html?id=${val}`;
            }
        });
    }

    function updateTrackingUI(order) {
        // Handle short ID display
        const shortId = order._id.substring(order._id.length - 6).toUpperCase();
        orderIdEl.textContent = `#MV${shortId}`;

        // Order Date
        const date = new Date(order.createdAt);
        orderDateEl.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Status Text & Badge
        const status = order.status.toLowerCase();
        // Map backend status to display friendly text
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'shipped': 'Shipped',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled',
            'returned': 'Returned',
            'return_requested': 'Return Requested'
        };
        const statusDisplay = statusMap[status] || capitalize(status);
        statusTextEl.textContent = statusDisplay;
        statusBadgeEl.className = `status-badge status-${status}`;

        // Estimated Delivery
        // If delivered, show delivery date. Else show ETA (e.g. +5 days from creation)
        let etaText = '';
        if (status === 'delivered') {
            const deliveryLog = (order.statusHistory || []).find(h => h.status === 'delivered');
            const deliveryDate = deliveryLog ? new Date(deliveryLog.timestamp) : new Date(order.updatedAt);
            etaText = `Delivered on ${deliveryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            document.querySelector('.summary-itemHighlight .summary-label').textContent = 'Delivery Date';
            etaDateEl.className = ''; // Remove accent if needed, or keep
        } else if (status === 'cancelled') {
            etaText = 'Cancelled';
            document.querySelector('.summary-itemHighlight .summary-label').textContent = 'Status';
        } else {
            const eta = new Date(date);
            eta.setDate(eta.getDate() + 5);
            etaText = eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            document.querySelector('.summary-itemHighlight .summary-label').textContent = 'Estimated Delivery';
        }
        etaDateEl.textContent = etaText;


        // 1. TIMELINE LOGIC
        renderTimeline(status, order);

        // 2. LOGS LOGIC
        renderLogs(order.statusHistory, order.createdAt);

        // 3. MAP/LOCATION LOGIC
        updateLocationDisplay(status);

        // 4. Navbar & Animations
        initVisualEffects();
    }

    function renderTimeline(currentStatus, order) {
        // Define standard flow steps
        const steps = [
            { id: 'pending', label: 'Order Placed', desc: 'Your order has been placed.', icon: '<i class="fas fa-clipboard-check"></i>' },
            { id: 'confirmed', label: 'Order Confirmed', desc: 'Order verified and processing.', icon: '<i class="fas fa-box-open"></i>' },
            { id: 'shipped', label: 'Shipped', desc: 'Package has left the facility.', icon: '<i class="fas fa-shipping-fast"></i>' },
            { id: 'delivered', label: 'Delivered', desc: 'Package arrived at destination.', icon: '<i class="fas fa-home"></i>' }
        ];

        // Helper to find timestamp for a specific status in history
        const getTimestamp = (statusId) => {
            // Special case: 'pending' is usually creation time
            if (statusId === 'pending') return order.createdAt;

            // Find in history
            const history = order.statusHistory || [];
            const entry = history.find(h => h.status === statusId);
            return entry ? entry.timestamp : null;
        };

        // Determine active index based on current status
        // Create a priority map
        const statusPriority = {
            'pending': 0,
            'confirmed': 1,
            'shipped': 2,
            'out_for_delivery': 2, // Map 'out_for_delivery' to 'Shipped' step visually or add new step? Sticking to 4 steps for simplified UI
            'delivered': 3,
            'returned': 3, // Treat as post-delivery
            'cancelled': -1
        };

        const activeIndex = statusPriority[currentStatus] !== undefined ? statusPriority[currentStatus] : 0;

        // Handling Cancelled State
        if (currentStatus === 'cancelled') {
            timelineContainer.innerHTML = `
                <div class="timeline-step completed">
                    <div class="step-marker"><i class="fas fa-check"></i></div>
                    <div class="step-info">
                        <span class="step-title">Order Placed</span>
                        <span class="step-timestamp">${formatTime(new Date(order.createdAt))}</span>
                    </div>
                </div>
                <div class="timeline-line completed" style="background: #ef4444;"></div>
                <div class="timeline-step active">
                    <div class="step-marker" style="background: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.5);"><i class="fas fa-times"></i></div>
                    <div class="step-info">
                        <span class="step-title" style="color: #ef4444;">Cancelled</span>
                        <span class="step-timestamp">${formatTime(new Date(order.updatedAt))}</span>
                        <p class="step-desc">This order has been cancelled.</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';

        steps.forEach((step, index) => {
            let stateClass = 'pending';
            let markerContent = '';

            const stepDate = getTimestamp(step.id);
            const isCompleted = index <= activeIndex;
            const isCurrent = index === activeIndex;

            if (index < activeIndex) {
                stateClass = 'completed';
                markerContent = '<i class="fas fa-check"></i>';
            } else if (index === activeIndex) {
                stateClass = 'active';
                markerContent = '<div class="marker-pulse"></div>' + step.icon; // Show icon for active
            } else {
                stateClass = 'pending';
                markerContent = step.icon; // Show icon for pending too? Or empty circle?
                markerContent = ''; // Keep simple dot for pending
            }

            // If we have a date for this step, show it. Otherwise if it's past/current, we might need a fallback?
            // Usually if index < activeIndex, it *should* have a date. If missing API data, fallback to 'Done'
            let timeDisplay = 'Pending';
            if (stepDate) {
                timeDisplay = formatTime(new Date(stepDate));
            } else if (index <= activeIndex) {
                // For legacy orders without full history, might miss intermediate dates
                timeDisplay = index === 0 ? formatTime(new Date(order.createdAt)) : '';
            }

            // Custom description if delivered
            let desc = step.desc;
            if (step.id === 'delivered' && currentStatus === 'returned') {
                desc = 'Order was delivered, then returned.';
            }

            html += `
                <div class="timeline-step ${stateClass}">
                    <div class="step-marker">${markerContent}</div>
                    <div class="step-info">
                        <span class="step-title">${step.label}</span>
                        <span class="step-timestamp">${timeDisplay}</span>
                        <p class="step-desc">${desc}</p>
                    </div>
                </div>
            `;

            // Connector Line
            if (index < steps.length - 1) {
                let lineClass = '';
                if (index < activeIndex) lineClass = 'completed';
                else if (index === activeIndex && currentStatus !== 'delivered') lineClass = 'active-line';

                html += `<div class="timeline-line ${lineClass}"></div>`;
            }
        });

        timelineContainer.innerHTML = html;
    }

    function renderLogs(history, createdAt) {
        statusLogContainer.innerHTML = '';

        // Clone and sort history: Newest first
        // If history is empty/undefined, mock basic log?
        let logs = history ? [...history] : [];

        // Ensure 'Order Placed' is in the logs if not present (usually not in statusHistory array which tracks updates)
        // Check if there's a 'pending' status in history
        const hasPending = logs.some(h => h.status === 'pending');
        if (!hasPending) {
            logs.push({
                status: 'pending', // internal code
                timestamp: createdAt,
                comment: 'Order successfully placed.'
            });
        }

        // Sort: Newest First
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const friendlyNames = {
            'pending': 'Order Placed',
            'confirmed': 'Order Confirmed',
            'shipped': 'Shipped',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled',
            'returned': 'Returned',
            'return_requested': 'Return Requested'
        };

        logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';

            const time = formatTime(new Date(log.timestamp));
            const statusName = friendlyNames[log.status] || capitalize(log.status);

            // If comment exists use it, else default text
            let comment = log.comment || '';
            if (!comment) {
                if (log.status === 'pending') comment = 'Order successfully placed.';
                if (log.status === 'confirmed') comment = 'Payment verified. Order processed.';
                if (log.status === 'shipped') comment = 'Package has left the facility.';
                if (log.status === 'delivered') comment = 'Package delivered to shipping address.';
            }

            entry.innerHTML = `
                <span class="log-time">${time}</span>
                <p><strong>${statusName}:</strong> ${comment}</p>
            `;
            statusLogContainer.appendChild(entry);
        });
    }

    function updateLocationDisplay(status) {
        const cityMap = {
            'pending': 'Processing Center',
            'confirmed': 'Processing Center',
            'shipped': 'In Transit', // Could be dynamic if we had location data
            'out_for_delivery': 'Local Hub',
            'delivered': 'Delivered to You',
            'returned': 'Returned to Warehouse',
            'cancelled': 'Cancelled'
        };
        currentCityEl.textContent = cityMap[status] || 'Processing Center';
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function formatTime(date) {
        if (!date) return '';
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    }

    function initVisualEffects() {
        // Navbar
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) navbar.classList.add('nav-scrolled');
            else navbar.classList.remove('nav-scrolled');
        });

        // Mobile Menu
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('nav-menu');
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }
    }
});
