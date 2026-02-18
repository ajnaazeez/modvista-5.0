document.addEventListener('DOMContentLoaded', () => {
    // API CONFIG
    const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
        ? "http://localhost:5000/api"
        : window.location.origin + "/api";
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
        window.location.href = "admin-login.html";
        return;
    }

    // --- Fetch Analytics Data ---
    const fetchAnalytics = async () => {
        try {
            const response = await fetch(`${API_BASE}/analytics/admin`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("adminToken");
                window.location.href = "admin-login.html";
                return;
            }

            const data = await response.json();
            if (data.success) {
                updateUI(data.data);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        }
    };

    const updateUI = (analytics) => {
        // Update KPIs
        const kpis = analytics.kpis;
        if (document.getElementById('totalRevenue')) document.getElementById('totalRevenue').textContent = `$${kpis.totalRevenue.toLocaleString()}`;
        if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = kpis.totalOrders.toLocaleString();
        if (document.getElementById('avgOrderValue')) document.getElementById('avgOrderValue').textContent = `$${kpis.avgOrderValue}`;
        if (document.getElementById('activeUsers')) document.getElementById('activeUsers').textContent = kpis.activeUsers.toLocaleString();
        if (document.getElementById('conversionRate')) document.getElementById('conversionRate').textContent = kpis.conversionRate;
        if (document.getElementById('aiPreviewUsage')) document.getElementById('aiPreviewUsage').textContent = kpis.aiPreviewUsage || 0;

        // Update Product Performance
        const tbody = document.getElementById('productPerformanceTbody');
        if (tbody) {
            tbody.innerHTML = analytics.productPerformance.map(p => `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM2NjYiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JTUc8L3RleHQ+PC9zdmc+"
                                class="product-img">
                            <span>${p.name}</span>
                        </div>
                    </td>
                    <td>—</td>
                    <td>${p.unitsSold}</td>
                    <td>$${p.revenue.toLocaleString()}</td>
                    <td><span style="color: var(--accent); font-weight: 600;">—</span></td>
                </tr>
            `).join('');
        }

        // --- Animations ---
        animateEntrance();
    };

    function animateEntrance() {
        // KPI Entrance Animation
        const kpiCards = document.querySelectorAll('.kpi-card');
        kpiCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 * index);
        });

        // Funnel Animation
        const funnelSteps = document.querySelectorAll('.funnel-step');
        funnelSteps.forEach((step, index) => {
            const progress = step.style.getPropertyValue('--progress');
            step.style.setProperty('--progress', '0%');
            setTimeout(() => {
                step.style.transition = 'all 1s cubic-bezier(0.4, 0, 0.2, 1)';
                step.style.setProperty('--progress', progress);
            }, 500 + (index * 150));
        });
    }

    // Period Buttons Interactivity
    const periodButtons = document.querySelectorAll('.analytics-section-grid .action-btn');
    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.parentElement;
            parent.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.action-btn').forEach(b => b.style.background = 'var(--bg-card)');

            btn.classList.add('active');
            btn.style.background = 'var(--accent)';

            // Simulate chart refresh
            const chartArea = parent.closest('.section-container').querySelector('.chart-placeholder');
            if (chartArea) {
                chartArea.style.opacity = '0.5';
                setTimeout(() => {
                    chartArea.style.opacity = '1';
                }, 300);
            }
        });
    });

    // Export Simulation
    const exportButtons = document.querySelectorAll('.export-btn-group button, .action-btn i.fa-download, .action-btn:has(i.fa-download)');
    exportButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            btn.disabled = true;

            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-check"></i> Exported';
                btn.style.backgroundColor = 'var(--status-delivered)';
                btn.style.borderColor = 'var(--status-delivered)';

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    btn.style.backgroundColor = '';
                    btn.style.borderColor = '';
                }, 2000);
            }, 1500);
        });
    });

    // Initial Load
    fetchAnalytics();
});
