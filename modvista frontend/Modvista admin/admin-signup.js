const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";

const API = `${API_BASE}/admin/auth/signup`;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("admin-signup-form");
    const nameEl = document.getElementById("admin-name");
    const emailEl = document.getElementById("admin-email");
    const phoneEl = document.getElementById("admin-phone");
    const passEl = document.getElementById("admin-password");
    const btn = document.getElementById("admin-signup-btn");
    const errEl = document.getElementById("admin-signup-error");
    const errText = document.getElementById("error-text");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errEl.classList.remove("show");
        errText.textContent = "";

        const name = nameEl.value.trim();
        const email = emailEl.value.trim().toLowerCase();
        const phone = phoneEl.value.trim();
        const password = passEl.value;

        if (password.length < 8) {
            errText.textContent = "Password must be at least 8 characters long";
            errEl.classList.add("show");
            return;
        }

        btn.disabled = true;
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = 'Creating Account... <i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, password })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Admin registration failed");

            // Store token and user info
            localStorage.setItem("adminToken", data.token);
            localStorage.setItem("adminUser", JSON.stringify(data.admin || {}));

            // Success redirect to dashboard
            window.location.href = "index.html";
        } catch (err) {
            errText.textContent = err.message;
            errEl.classList.add("show");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    });
});
