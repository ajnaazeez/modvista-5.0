// cart-script.js (BACKEND CONNECTED VERSION)
(function () {
    const API_BASE = (window.ModVistaAPI && window.ModVistaAPI.API_BASE) ? window.ModVistaAPI.API_BASE.replace('/api', '') : "http://localhost:5000";

    // -------- Helpers --------
    function getToken() {
        return localStorage.getItem("token");
    }

    function requireLogin() {
        if (!getToken()) {
            localStorage.setItem("redirectUrl", "cart.html");
            window.location.href = "login.html";
            return false;
        }
        return true;
    }

    function authHeaders() {
        return {
            "Content-Type": "application/json",
            Authorization: "Bearer " + getToken()
        };
    }

    // -------- API Calls --------
    async function fetchCart() {
        const res = await fetch(`${API_BASE}/api/cart`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error("Failed to fetch cart");
        return res.json();
    }

    async function updateItemQuantity(itemId, quantity) {
        try {
            const res = await fetch(`${API_BASE}/api/cart/item/${itemId}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ quantity })
            });
            if (!res.ok) throw new Error("Failed to update quantity");
            renderCart(); // Re-render after update
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }

    async function removeItem(itemId) {
        try {
            const res = await fetch(`${API_BASE}/api/cart/item/${itemId}`, {
                method: "DELETE",
                headers: authHeaders()
            });
            if (!res.ok) throw new Error("Failed to remove item");
            renderCart();
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }

    // -------- UI Render --------
    async function renderCart() {
        if (!requireLogin()) return;

        const cartContainer = document.getElementById("cart-container");
        const list = document.getElementById("cart-items-list");
        const emptyMsg = document.getElementById("empty-cart-msg");

        try {
            const cart = await fetchCart();
            const items = cart.items || [];

            if (items.length === 0) {
                if (cartContainer) cartContainer.style.display = "none";
                if (emptyMsg) emptyMsg.style.display = "block";
                updateCartBadge(0);
                return;
            }

            if (cartContainer) cartContainer.style.display = "grid";
            if (emptyMsg) emptyMsg.style.display = "none";
            if (list) list.innerHTML = "";

            let subtotal = 0;

            // Fix: Explicitly check if list container exists before trying to append
            if (list) {
                items.forEach(item => {
                    // Fallback in case product population failed (deleted product)
                    const product = item.product || { name: 'Unknown Product', price: 0 };

                    // Handle image paths correctly
                    let img = "assets/default-product.png"; // fallback
                    if (product.images && product.images.length > 0) {
                        const imagePath = product.images[0];
                        if (imagePath.startsWith('uploads/')) {
                            // Backend served images
                            img = `http://localhost:5000/${imagePath}`;
                        } else if (imagePath.startsWith('assets/')) {
                            // Frontend assets
                            img = imagePath;
                        } else {
                            // Fallback: assume frontend asset
                            img = `assets/${imagePath}`;
                        }
                    }

                    const itemTotal = product.price * item.quantity;
                    subtotal += itemTotal;

                    const row = document.createElement("div");
                    row.className = "cart-item";
                    row.innerHTML = `
        <div class="item-img"><img src="${img}" alt="${product.name}"></div>
        <div class="item-info">
          <h3>${product.name}</h3>
          <p>Variant: ${item.variant || 'Standard'}</p>
        </div>
        <div class="item-qty">
          <button class="qty-btn minus">-</button>
          <input type="number" value="${item.quantity}" readonly />
          <button class="qty-btn plus">+</button>
        </div>
        <div class="item-price">$${itemTotal.toFixed(2)}</div>
        <button class="remove-item"><i class="fas fa-trash"></i></button>
      `;

                    // Require requirement #2: if quantity <= 0 remove item
                    row.querySelector(".minus").onclick = () => {
                        if (item.quantity > 1) {
                            updateItemQuantity(item._id, item.quantity - 1);
                        } else {
                            removeItem(item._id);
                        }
                    };

                    row.querySelector(".plus").onclick = () =>
                        updateItemQuantity(item._id, item.quantity + 1);

                    row.querySelector(".remove-item").onclick = () =>
                        removeItem(item._id);

                    list.appendChild(row);
                });
            }

            if (document.getElementById("subtotal"))
                document.getElementById("subtotal").textContent = `$${subtotal.toFixed(2)}`;
            if (document.getElementById("total-price"))
                document.getElementById("total-price").textContent = `$${subtotal.toFixed(2)}`;

            updateCartBadge(items.reduce((sum, i) => sum + i.quantity, 0));

        } catch (error) {
            console.error("Render Cart Error:", error);
            if (list) list.innerHTML = `<p style="color:red">Error loading cart: ${error.message}</p>`;
        }
    }

    // -------- Cart Badge --------
    function updateCartBadge(count) {
        document.querySelectorAll(".cart-count-badge").forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? "flex" : "none";
        });
    }

    // -------- Init --------
    document.addEventListener("DOMContentLoaded", () => {
        // Only run renderCart if we are on a page that needs it (check for element presence or generic)
        // But the script is loaded on checkout pages etc.
        // checkout.html uses checkout.js for rendering summary, BUT cart-script.js runs usually on cart.html.
        // However, checkout.html includes it. Let's make it safe.
        if (document.getElementById("cart-items-list")) {
            renderCart();
        }

        const checkoutBtn = document.getElementById("proceed-checkout");
        if (checkoutBtn) {
            checkoutBtn.onclick = () => {
                window.location.href = "checkout.html";
            };
        }
    });

})(); // End IIFE
