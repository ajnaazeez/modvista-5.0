/**
 * ModVista - Shop Page Script
 * Fetches products from backend and renders them via DOM.
 * "Add to Cart" logic is handled by cart-actions.js via delegation.
 */

// Use centralized API_BASE from api.js
const getApiBase = () => {
    return (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
};

const API_PRODUCTS_URL = `${getApiBase()}/products`;
const API_CATEGORIES_URL = `${getApiBase()}/categories`;

let allProducts = []; // Store globally for client-side filtering
let currentFilters = {
    category: 'all',
    minPrice: null,
    maxPrice: null,
    rating: 0,
    sortBy: 'popular'
};

document.addEventListener('DOMContentLoaded', () => {
    // Check for category in URL
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('category');
    if (catParam) {
        currentFilters.category = catParam;
    }

    fetchProducts();
    loadShopCategories();
    // Mobile filter logic
    setupMobileFilters();
    // Setup Filters
    setupPriceFilter();
    setupRatingFilter();
    setupSortFilter();
});

async function loadShopCategories() {
    const list = document.getElementById('sidebar-category-list');
    if (!list) return;

    try {
        const res = await fetch(API_CATEGORIES_URL);
        const responseData = await res.json();
        const categories = Array.isArray(responseData) ? responseData : (responseData.data || []);

        // Function to get icon based on name
        const getIcon = (name) => {
            const n = name.toLowerCase();
            if (n.includes('exterior')) return 'fas fa-car';
            if (n.includes('interior')) return 'fas fa-couch';
            if (n.includes('performance')) return 'fas fa-tachometer-alt';
            if (n.includes('wheel')) return 'fas fa-circle-notch';
            if (n.includes('headlight')) return 'fas fa-lightbulb';
            if (n.includes('spoiler')) return 'fas fa-wind';
            return 'fas fa-tags';
        };

        let html = ''; // Initialize html string

        categories.forEach(cat => {
            // Calculate count for this category
            const count = allProducts.filter(p => {
                const pCatId = p.category?._id || p.category;
                return pCatId === cat._id;
            }).length;

            // Check if this category is active
            // Handle URL param being a slug or name instead of ID
            let match = false;
            if (currentFilters.category === cat._id) match = true;
            if (currentFilters.category.toLowerCase() === cat.name.toLowerCase()) {
                currentFilters.category = cat._id; // Switch to ID for filtering
                match = true;
            }
            if (cat.slug && currentFilters.category.toLowerCase() === cat.slug.toLowerCase()) {
                currentFilters.category = cat._id; // Switch to ID for filtering
                match = true;
            }
            if ((currentFilters.category === 'all' && cat._id === 'all')) match = true;

            html += `<li><a href="#" class="${match ? 'active' : ''}" data-cat="${cat._id}"><i class="${getIcon(cat.name)}"></i> ${cat.name} <span class="count">${count}</span></a></li>`;
        });

        // Also update "All" active state
        const allActive = currentFilters.category === 'all' ? 'active' : '';
        html = `<li><a href="#" class="${allActive}" data-cat="all"><i class="fas fa-border-all"></i> All Products <span class="count">${allProducts.length}</span></a></li>` + html;

        list.innerHTML = html;
        attachCategoryListeners();

        // Re-apply filters now that we might have resolved URL slug to ID
        applyFilters();

    } catch (err) {
        console.error("Failed to load categories", err);
        list.innerHTML = `<li><a href="#" class="active" data-cat="all"><i class="fas fa-border-all"></i> All Products <span class="count">${allProducts.length}</span></a></li>`;
    }
}

function attachCategoryListeners() {
    const links = document.querySelectorAll('#sidebar-category-list a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Active state
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            currentFilters.category = link.dataset.cat;
            applyFilters();
        });
    });
}

function setupPriceFilter() {
    const applyBtn = document.querySelector('.apply-filter-btn');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const min = document.getElementById('price-min').value;
        const max = document.getElementById('price-max').value;

        currentFilters.minPrice = min ? parseFloat(min) : null;
        currentFilters.maxPrice = max ? parseFloat(max) : null;

        applyFilters();
    });
}

function setupRatingFilter() {
    const links = document.querySelectorAll('#rating-filter-list a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            currentFilters.rating = parseFloat(link.dataset.rating || 0);
            applyFilters();
        });
    });
}

function setupSortFilter() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    select.addEventListener('change', (e) => {
        currentFilters.sortBy = e.target.value;
        applyFilters();
    });
}

function applyFilters() {
    const { category, minPrice, maxPrice, rating, sortBy } = currentFilters;

    let filtered = [...allProducts];

    // 1. Filter by Category
    if (category !== 'all') {
        filtered = filtered.filter(p => {
            const pCatId = p.category?._id || p.category;
            return pCatId === category;
        });
    }

    // 2. Filter by Price
    if (minPrice !== null) {
        filtered = filtered.filter(p => p.price >= minPrice);
    }
    if (maxPrice !== null) {
        filtered = filtered.filter(p => p.price <= maxPrice);
    }

    // 3. Filter by Rating
    if (rating > 0) {
        filtered = filtered.filter(p => (p.rating || 4.5) >= rating);
    }

    // 4. Apply Sorting
    applySorting(filtered, sortBy);

    renderProducts(filtered);
    updateCount(filtered.length);
}

function applySorting(products, sortBy) {
    switch (sortBy) {
        case 'newest':
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'price-low':
            products.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            products.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            products.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
            break;
        case 'popular':
        default:
            // Fallback to rating or keep as is
            products.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
            break;
    }
}

function updateCount(count) {
    const strongs = document.querySelectorAll('.results-count strong');
    if (strongs.length >= 2) {
        strongs[0].textContent = count;
        // Total might remain total or change to filtered? usually "Showing X of Y"
        // Let's just update showing count
    }
}

async function fetchProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="loading-text">Loading premium mods...</p>';

    try {
        const res = await fetch(API_PRODUCTS_URL);
        if (!res.ok) throw new Error('Failed to load products');

        const products = await res.json();

        // Support different response structures
        let productList = [];
        if (Array.isArray(products)) {
            productList = products;
        } else if (products && Array.isArray(products.data)) {
            productList = products.data;
        } else if (products && Array.isArray(products.products)) {
            productList = products.products;
        } else if (products && Array.isArray(products.value)) {
            productList = products.value;
        }

        allProducts = productList; // Store global
        renderProducts(allProducts);

        // Refresh categories to update counts now that we have products
        loadShopCategories();

        const strongs = document.querySelectorAll('.results-count strong');
        if (strongs.length >= 2) {
            strongs[0].textContent = allProducts.length; // showing
            strongs[1].textContent = allProducts.length; // total
        }

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="error-text">Failed to load products. Please try again later.</p>';
    }
}

function resolveShopImg(src) {
    if (!src) return "assets/default.png";
    if (src.startsWith("uploads/")) return `http://localhost:5000/${src}`;
    if (src.startsWith("/uploads/")) return `http://localhost:5000${src}`;
    return src;
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    if (!products || products.length === 0) {
        grid.innerHTML = '<p>No products found.</p>';
        return;
    }

    products.forEach(product => {
        const image = resolveShopImg(product.images?.[0]);

        const price = typeof product.price === 'number' ? product.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';
        const rating = product.rating || 4.5;
        const productId = product._id;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productId = productId;

        card.innerHTML = `
            <div class="product-img">
                <button class="wishlist-btn" data-product-id="${productId}"><i class="far fa-heart"></i></button>
                <a href="product-details.html?id=${productId}">
                    <img src="${image}" alt="${product.name}" onerror="this.onerror=null; this.src='assets/default.png';">
                </a>
                <button class="add-cart-btn" data-product-id="${productId}" data-variant="Standard">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-meta">
                    <span class="price">$${price}</span>
                    <div class="rating"><i class="fas fa-star"></i><span>${rating}</span></div>
                </div>
                <a href="ai-preview.html" class="view-details"><i class="fas fa-magic"></i> Try AI Preview</a>
            </div>
        `;

        // Wishlist Toggle Listener
        const wishBtn = card.querySelector('.wishlist-btn');
        wishBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (typeof window.WishlistActions === 'undefined') {
                console.error("WishlistActions not loaded");
                return;
            }

            wishBtn.disabled = true;
            const success = await window.WishlistActions.toggleWishlist(productId);
            wishBtn.disabled = false;

            if (success) {
                const icon = wishBtn.querySelector('i');
                icon.classList.toggle('far');
                icon.classList.toggle('fas');
                icon.style.color = icon.classList.contains('fas') ? '#ff4757' : '';
            }
        });

        grid.appendChild(card);
    });

    // Check current wishlist status to highlight hearts
    syncWishlistHearts();
}

async function syncWishlistHearts() {
    if (typeof window.WishlistActions === 'undefined') return;
    if (!window.ModVistaAPI.getToken()) return; // Don't fetch if guest
    const wishlist = await window.WishlistActions.getWishlist();
    const wishIds = wishlist.map(item => item._id || item);

    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const id = btn.dataset.productId;
        const icon = btn.querySelector('i');
        if (wishIds.includes(id)) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            icon.style.color = '#ff4757';
        } else {
            icon.classList.add('far');
            icon.classList.remove('fas');
            icon.style.color = '';
        }
    });
}

function setupMobileFilters() {
    const filterToggle = document.getElementById('mobile-filter-toggle');
    const filtersSidebar = document.getElementById('filters-sidebar');
    const closeFilters = document.getElementById('close-filters');

    if (filterToggle && filtersSidebar) {
        filterToggle.addEventListener('click', () => {
            filtersSidebar.classList.add('active');
        });
    }

    if (closeFilters && filtersSidebar) {
        closeFilters.addEventListener('click', () => {
            filtersSidebar.classList.remove('active');
        });
    }
}
