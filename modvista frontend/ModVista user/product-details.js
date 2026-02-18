const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
const localApiBase = getApiBase();

function getProductIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

async function fetchProduct(id) {
    const res = await fetch(`${localApiBase}/products/${id}`);
    if (!res.ok) throw new Error("Product not found");
    return res.json();
}

function resolveImg(src) {
    if (!src) return "assets/default.png";
    if (src.startsWith("uploads/") || src.startsWith("/uploads/")) {
        const cleanPath = src.startsWith('/') ? src.slice(1) : src;
        // Fix: API_BASE was not defined in this scope, use localApiBase
        return `${localApiBase.replace('/api', '')}/${cleanPath}`;
    }
    if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) {
        return src;
    }
    return src;
}

function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
}

function setImage(selector, src, fallback = "assets/default.png") {
    const img = document.querySelector(selector);
    if (!img) return;
    const resolved = resolveImg(src);
    img.src = resolved;
    img.onerror = () => {
        img.onerror = null;
        img.src = fallback;
    };
}

function renderStars(rating = 0) {
    const full = Math.round(rating);
    let stars = "";
    for (let i = 1; i <= 5; i++) {
        stars += `<i class="fas fa-star" style="${i <= full ? "" : "opacity:0.25"}"></i>`;
    }
    return stars;
}

document.addEventListener("DOMContentLoaded", async () => {
    const id = getProductIdFromURL();
    console.log("Loading product details for ID:", id);

    if (!id) {
        // Option: redirect or show generic
        console.warn("No ID found in URL");
        // alert("No product ID specified");
        // window.location.href = "shop.html";
        return;
    }

    try {
        const product = await fetchProduct(id);
        console.log("Product fetched:", product);

        setText(".product-title", product.name);
        setText(".product-price", `$${Number(product.price || 0).toFixed(2)}`);

        const shortEl = document.querySelector(".short-desc");
        if (shortEl) shortEl.textContent = product.description || "No description available.";

        // Image Handling
        const images = product.images && product.images.length > 0 ? product.images : ["assets/default.png"];
        const mainImgSrc = images[0];

        setImage("#main-img", mainImgSrc, "assets/default.png");

        // Render Thumbnails
        const thumbGrid = document.querySelector(".thumbnail-grid");
        if (thumbGrid && images.length > 1) {
            thumbGrid.innerHTML = ""; // Clear static thumbs
            images.forEach((imgSrc, index) => {
                const thumbDiv = document.createElement("div");
                thumbDiv.className = `thumb ${index === 0 ? "active" : ""}`;
                const resolved = resolveImg(imgSrc);

                thumbDiv.innerHTML = `<img src="${resolved}" alt="Thumb ${index + 1}" onerror="this.src='assets/default.png'">`;

                thumbDiv.addEventListener("click", () => {
                    // Update main image
                    setImage("#main-img", imgSrc);
                    // Update active state
                    document.querySelectorAll(".thumb").forEach(t => t.classList.remove("active"));
                    thumbDiv.classList.add("active");
                });

                thumbGrid.appendChild(thumbDiv);
            });
        } else if (thumbGrid) {
            thumbGrid.innerHTML = ""; // Clear if only 1 image
        }

        const stock = Number(product.stock || 0);
        const stockEl = document.querySelector(".stock-status");
        if (stockEl) {
            stockEl.innerHTML =
                stock > 0
                    ? `<i class="fas fa-check-circle"></i> In Stock`
                    : `<i class="fas fa-times-circle"></i> Out of Stock`;
        }

        const rating = Number(product.rating || 0);
        const numReviews = Number(product.numReviews || 0);
        const ratingBox = document.querySelector(".product-stats .rating");
        if (ratingBox) {
            ratingBox.innerHTML = `${renderStars(rating)} <span>(${numReviews} Customer Reviews)</span>`;
        }

        const addBtn = document.querySelector(".add-to-cart-big");
        const qtyInput = document.querySelector(".qty-selector input");

        if (addBtn) {
            addBtn.addEventListener("click", async (e) => {
                e.preventDefault();

                if (typeof addToCartGlobal !== 'function') {
                    console.error("addToCartGlobal not found");
                    alert("Cart system unavailable. Please refresh.");
                    return;
                }

                const originalHTML = addBtn.innerHTML;
                addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                addBtn.disabled = true;

                try {
                    const qty = qtyInput ? Number(qtyInput.value || 1) : 1;
                    await addToCartGlobal(id, qty, "Standard");
                } catch (err) {
                    console.error(err);
                } finally {
                    addBtn.innerHTML = originalHTML;
                    addBtn.disabled = false;
                }
            });
        }

        // Wishlist Logic
        const wishBtn = document.getElementById('wishlist-btn-detail');
        if (wishBtn) {
            // Initial State
            syncWishlistStatus(id, wishBtn);

            wishBtn.addEventListener('click', async () => {
                if (typeof window.WishlistActions === 'undefined') {
                    console.error("WishlistActions not loaded");
                    return;
                }
                wishBtn.disabled = true;
                const success = await window.WishlistActions.toggleWishlist(id);
                wishBtn.disabled = false;
                if (success) {
                    syncWishlistStatus(id, wishBtn);
                }
            });
        }

        const qtyMinus = document.querySelector(".qty-selector button:first-child");
        const qtyPlus = document.querySelector(".qty-selector button:last-child");

        if (qtyInput && qtyMinus && qtyPlus) {
            qtyMinus.addEventListener("click", () => {
                const v = Math.max(1, Number(qtyInput.value || 1) - 1);
                qtyInput.value = v;
            });
            qtyPlus.addEventListener("click", () => {
                const v = Math.min(99, Number(qtyInput.value || 1) + 1);
                qtyInput.value = v;
            });
        }
    } catch (err) {
        console.error(err);
        alert(`Failed to load product details: ${err.message}`);
        // window.location.href = "shop.html"; // Commented out to allow debugging
    }
});

async function syncWishlistStatus(productId, btn) {
    if (typeof window.WishlistActions === 'undefined') return;
    try {
        const wishlist = await window.WishlistActions.getWishlist();
        const isInWishlist = wishlist.some(item => (item._id || item) === productId);
        const icon = btn.querySelector('i');
        if (isInWishlist) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            icon.style.color = '#ff4757';
        } else {
            icon.classList.add('far');
            icon.classList.remove('fas');
            icon.style.color = '';
        }
    } catch (err) {
        console.error('Failed to sync wishlist status:', err);
    }
}
