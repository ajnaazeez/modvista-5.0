document.addEventListener('DOMContentLoaded', async () => {
    // 0. Security Check
    if (!window.ModVistaAPI || !window.ModVistaAPI.requireLogin()) return;

    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.classList.add('scrolled');
        window.addEventListener('scroll', () => {
            navbar.classList.add('scrolled');
        });
    }

    // 1. Initial Load
    showLoadingSkeletons();

    let allProfileOrders = [];

    // Parallel fetch for speed
    Promise.allSettled([
        fetchUserProfile(),
        fetchUserVehicles(),
        fetchUserAddresses(),
        fetchUserOrders(),
        fetchUserWishlist(),
        fetchProfileWallet()
    ]);

    initSectionSwitching();

    // ---------- Data Fetching ----------

    async function fetchUserProfile() {
        try {
            const data = await window.ModVistaAPI.apiCall('/users/me');
            if (data && data.success) {
                renderProfileData(data.user);
            }
        } catch (error) {
            console.error("Profile load error:", error);
            showError('my-profile', 'Failed to load profile details');
        }
    }

    async function fetchUserVehicles() {
        try {
            const data = await window.ModVistaAPI.apiCall('/vehicles');
            if (data && data.success) {
                renderVehicles(data.vehicles);
            }
        } catch (error) {
            console.error("Vehicles load error:", error);
            showError('vehicles-grid', 'Failed to load vehicles');
        }
    }

    async function fetchUserAddresses() {
        try {
            const data = await window.ModVistaAPI.apiCall('/addresses');
            if (data && data.success) {
                const defaultAddr = data.data.find(addr => addr.isDefault) || data.data[0];
                renderDefaultAddress(defaultAddr);
            }
        } catch (error) {
            console.error("Address load error:", error);
            document.getElementById('default-address-container').innerHTML = '<p class="text-error">Failed to load address</p>';
        }
    }

    async function fetchUserOrders() {
        const orderContainer = document.getElementById('profile-orders-container');
        if (!orderContainer) return;

        try {
            const data = await window.ModVistaAPI.apiCall('/orders/my');
            if (data && data.success) {
                allProfileOrders = data.data;
                renderOrdersPreview(allProfileOrders);
            }
        } catch (error) {
            console.error("Orders load error:", error);
            orderContainer.innerHTML = '<p class="text-error">Failed to load recent orders</p>';
        }
    }

    async function fetchUserWishlist() {
        const grid = document.getElementById('profile-wishlist-grid');
        if (!grid) return;

        try {
            const data = await window.ModVistaAPI.apiCall('/wishlist');
            if (data && data.success) {
                renderWishlistPreview(data.data);
            }
        } catch (error) {
            console.error("Wishlist load error:", error);
            grid.innerHTML = '<p class="text-error">Failed to load wishlist</p>';
        }
    }

    async function fetchProfileWallet() {
        try {
            const data = await window.ModVistaAPI.apiCall('/wallet/balance');
            if (data && data.success) {
                renderProfileWallet(data.balance);
            }
        } catch (error) {
            console.error("Wallet load error:", error);
        }
    }

    // ---------- Rendering ----------

    function renderWishlistPreview(items) {
        const grid = document.getElementById('profile-wishlist-grid');
        const emptyState = document.getElementById('profile-wishlist-empty');
        if (!grid) return;

        grid.innerHTML = '';
        if (!items || items.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Limit to 4 items for preview
        items.slice(0, 4).forEach(product => {
            const itemEl = document.createElement('div');
            itemEl.className = 'wishlist-preview-card';

            let img = "assets/default-product.png";
            if (product.images && product.images.length > 0) {
                const baseUrl = window.ModVistaAPI.API_BASE.replace('/api', '');
                img = product.images[0].startsWith('uploads/') ? `${baseUrl}/${product.images[0]}` : product.images[0];
            }

            itemEl.innerHTML = `
                <div class="wishlist-img"><img src="${img}" alt="${product.name}"></div>
                <div class="wishlist-details">
                    <h4>${product.name}</h4>
                    <p>$${product.price.toFixed(2)}</p>
                </div>
            `;
            grid.appendChild(itemEl);
        });
    }

    function initSectionSwitching() {
        const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
        const sections = document.querySelectorAll('.content-section');

        // Map menu button icons/text to section IDs
        const menuMap = {
            'My Profile': 'my-profile',
            'My Orders': 'my-orders',
            'Order Tracking': 'order-tracking',
            'Returns & Refunds': 'returns',
            'Saved Addresses': 'addresses',
            'Wallet': 'wallet',
            'Wishlist': 'wishlist'
        };

        menuItems.forEach(item => {
            const text = item.innerText.trim();
            const sectionId = menuMap[text];

            if (sectionId) {
                item.onclick = (e) => {
                    e.preventDefault();

                    // Update Active Menu
                    menuItems.forEach(mi => mi.classList.remove('active'));
                    item.classList.add('active');

                    // Show Correct Section
                    sections.forEach(s => s.style.display = 'none');
                    const target = document.getElementById(sectionId);
                    if (target) {
                        target.style.display = 'block';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                };
            }
        });

        // Quick action cards
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            const span = card.querySelector('span');
            if (span) {
                const text = span.innerText.trim();
                const sectionId = menuMap[text];
                if (sectionId) {
                    card.onclick = (e) => {
                        e.preventDefault();
                        const menuBtn = Array.from(menuItems).find(mi => mi.innerText.trim() === text);
                        if (menuBtn) menuBtn.click();
                    };
                }
            }
        });
    }

    function renderProfileWallet(balance) {
        const el = document.getElementById('profile-wallet-balance');
        if (el) el.innerText = `₹${balance.toFixed(2)}`;
    }

    function renderProfileData(user) {
        // Identity
        setText('profileName', user.name);
        setText('profileEmail', user.email);

        // Detailed Information Card
        setText('profile-name', user.name);
        setText('profile-email', user.email);
        setText('profile-phone', user.phone || 'Not provided');

        // Avatar
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            if (window.setupAvatarFallback) {
                window.setupAvatarFallback(profileAvatar, user.name);
            }

            if (user.avatarUrl) {
                // Ensure correct URL
                const baseUrl = window.ModVistaAPI.API_BASE.replace('/api', '');
                profileAvatar.src = `${baseUrl}${user.avatarUrl}`;
            } else {
                if (profileAvatar.onerror) profileAvatar.onerror();
            }
        }
    }

    function renderVehicles(vehicles) {
        const vehiclesGrid = document.querySelector('.vehicles-grid');
        if (!vehiclesGrid) return;

        const addNewCard = vehiclesGrid.querySelector('.add-new');
        vehiclesGrid.innerHTML = '';

        if (vehicles.length === 0) {
            if (addNewCard) vehiclesGrid.appendChild(addNewCard);
            return;
        }

        vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = `vehicle-card ${vehicle.isDefault ? 'default' : ''}`;
            card.innerHTML = `
                <div class="vehicle-icon"><i class="fas fa-car-side"></i></div>
                <div class="vehicle-details">
                    <h4>${vehicle.make} ${vehicle.model}</h4>
                    <p>${vehicle.year} • ${vehicle.variant || 'Standard'}</p>
                    ${vehicle.isDefault ? '<span class="badge">Default</span>' : ''}
                </div>
                <div class="vehicle-actions">
                    <button class="icon-btn" onclick="window.location.href='saved-vehicles.html'"><i class="fas fa-edit"></i></button>
                </div>
            `;
            vehiclesGrid.appendChild(card);
        });

        if (addNewCard) vehiclesGrid.appendChild(addNewCard);
    }

    function renderDefaultAddress(address) {
        const container = document.getElementById('default-address-container');
        if (!container) return;

        if (!address) {
            container.innerHTML = '<p class="text-muted">No address saved yet</p>';
            return;
        }

        container.innerHTML = `
            <p>
                <strong>${address.fullName}</strong><br>
                ${address.street}, ${address.landmark ? address.landmark + ', ' : ''}<br>
                ${address.city}, ${address.state} ${address.pincode}<br>
                Phone: ${address.phone}
            </p>
        `;
    }

    function renderOrdersPreview(orders) {
        const orderContainer = document.getElementById('profile-orders-container');
        const emptyState = document.getElementById('profile-orders-empty');
        if (!orderContainer) return;

        orderContainer.innerHTML = '';

        if (!orders || orders.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Helpers for Premium Look
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        const getImagePath = (img) => {
            if (!img) return 'assets/default-product.png';
            if (img.startsWith('http')) return img;
            const apiBase = window.ModVistaAPI?.API_BASE || "http://localhost:5000/api";
            const backendRoot = apiBase.replace(/\/api\/?$/, '');
            if (img.startsWith('uploads/')) return `${backendRoot}/${img}`;
            if (img.startsWith('assets/')) return img;
            return `assets/${img}`;
        };
        const getActionButtons = (orderId, status) => {
            const s = status.toLowerCase();
            let btns = `
                <a href="order-details.html?id=${orderId}" class="action-btn btn-view" 
                   style="padding: 8px 20px; border-radius: 6px; font-size: 0.825rem; font-weight: 600; text-decoration: none; transition: all 0.2s ease; background: rgba(255, 31, 31, 0.1); border: 1px solid rgba(255, 31, 31, 0.3); color: #fff; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-info-circle" style="color: #ff1f1f; font-size: 0.9rem;"></i> Details
                </a>`;
            if (s === 'shipped') btns += `<a href="order-tracking.html?id=${orderId}" class="action-btn btn-secondary" style="padding: 8px 20px; border-radius: 6px; font-size: 0.825rem; font-weight: 600; text-decoration: none; color: #ccc; border: 1px solid #444; display: flex; align-items: center; gap: 8px;"><i class="fas fa-truck"></i> Track</a>`;
            return btns;
        };

        // Render all orders in the profile section
        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card'; // Use same class as orders.html
            card.style.cssText = 'background: #1a1a1a; border: 1px solid #2d2d2d; border-radius: 12px; overflow: hidden; margin-bottom: 20px;';

            const statusRaw = (order.status || 'pending').toLowerCase();
            const dateObj = new Date(order.createdAt);
            const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
            const shortId = order._id.substring(order._id.length - 8).toUpperCase();
            const itemsCount = order.items ? order.items.length : 0;
            const shownItems = order.items ? order.items.slice(0, 3) : [];

            card.innerHTML = `
                <div class="order-card-header" style="background: rgba(255, 255, 255, 0.03); padding: 16px 24px; border-bottom: 1px solid #2d2d2d;">
                    <div class="order-meta-info" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center;">
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">ID</small>
                            <span style="font-weight: bold; color: #ff1f1f;">#${shortId}</span>
                        </div>
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Date</small>
                            <span style="color: #eee;">${dateFormatted}</span>
                        </div>
                        <div class="meta-item">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Status</small>
                            <span class="status-${statusRaw}" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-size: 0.85rem;">
                                ${capitalize(order.status)}
                            </span>
                        </div>
                        <div class="meta-item" style="margin-left: auto;">
                            <small style="color: #888; display: block; font-size: 10px; text-transform: uppercase;">Total</small>
                            <span style="font-weight: 800; color: white; font-size: 1.1rem;">$${(order.total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="order-card-body" style="padding: 20px; display: block;">
                    <div class="product-previews" style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                        ${itemsCount === 1 ? `
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <img src="${getImagePath(shownItems[0].image)}" 
                                     style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #333;"
                                     onerror="this.src='assets/default-product.png'">
                                <div>
                                    <span style="font-weight: 600; color: #fff; display: block; font-size: 0.95rem;">${shownItems[0].name}</span>
                                    <span style="font-size: 0.8rem; color: #888;">${shownItems[0].variant || 'Standard'}</span>
                                </div>
                            </div>
                        ` : `
                            ${shownItems.map(item => `
                                <img src="${getImagePath(item.image)}" 
                                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #333;"
                                     onerror="this.src='assets/default-product.png'">
                            `).join('')}
                            ${itemsCount > 3 ? `<span style="color: #888; font-size: 0.85rem;">+${itemsCount - 3} more</span>` : ''}
                        `}
                    </div>
                </div>
                <div class="order-card-footer" style="padding: 12px 24px; background: rgba(0, 0, 0, 0.1); border-top: 1px solid #2d2d2d; display: flex; justify-content: flex-end;">
                    ${getActionButtons(order._id, order.status)}
                </div>
            `;
            orderContainer.appendChild(card);
        });
    }

    // ---------- Filter & Sort Logic ----------
    function applyProfileOrderFilters() {
        const filterValue = document.getElementById('profile-order-filter')?.value || 'all';
        const sortValue = document.getElementById('profile-order-sort')?.value || 'newest';

        let filtered = [...allProfileOrders];

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

        renderOrdersPreview(filtered);
    }

    // Listeners
    document.getElementById('profile-order-filter')?.addEventListener('change', applyProfileOrderFilters);
    document.getElementById('profile-order-sort')?.addEventListener('change', applyProfileOrderFilters);

    // ---------- Helpers ----------

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    function showLoadingSkeletons() {
        // Implementation for simple text skeletons if needed
    }

    function showError(id, message) {
        const el = document.getElementById(id);
        if (el) {
            // Toast fallback
            if (window.showToast) window.showToast(message, 'error');
        }
    }
});
