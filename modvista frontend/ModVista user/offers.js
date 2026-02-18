const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
const localApiBase = getApiBase();

document.addEventListener('DOMContentLoaded', () => {
    fetchActiveOffers();
});

async function fetchActiveOffers() {
    try {
        console.log("Fetching offers from:", `${localApiBase}/offers`);
        const response = await fetch(`${localApiBase}/offers`);
        const data = await response.json();
        console.log("Offers data:", data);

        const grid = document.getElementById('active-offers-grid');
        const emptyState = document.getElementById('empty-state');

        if (data.success && data.data && data.data.length > 0) {
            if (emptyState) emptyState.style.display = 'none';
            if (grid) {
                // Separate featured offer (e.g., New Year or Interior)
                const featuredOfferIndex = data.data.findIndex(o => o.title.toLowerCase().includes('new year') || o.title.toLowerCase().includes('interior'));
                let otherOffers = data.data;

                if (featuredOfferIndex !== -1) {
                    const featuredOffer = data.data[featuredOfferIndex];
                    renderFeaturedOffer(featuredOffer);
                    otherOffers = data.data.filter((_, i) => i !== featuredOfferIndex);
                }

                grid.style.display = 'grid';
                renderOffers(otherOffers);
            }
        } else {
            if (emptyState) emptyState.style.display = 'block';
            if (grid) grid.style.display = 'none';
        }
    } catch (error) {
        console.error("Error fetching offers:", error);
    }
}

function renderOffers(offers) {
    const grid = document.getElementById('active-offers-grid');
    if (!grid) return;

    grid.innerHTML = offers.map(offer => {
        const discountText = offer.discountType === 'percentage' ? `${offer.value}% OFF` : `₹${offer.value} OFF`;
        const validity = offer.endDate
            ? `Valid till ${new Date(offer.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : "Valid for limited time";

        return `
            <div class="offer-card ${offer.applicable === 'interior' ? 'featured' : ''}">
                ${offer.bannerImage ? `<div class="offer-product-image"><img src="${offer.bannerImage}" alt="${offer.title}"></div>` : ''}
                <div class="offer-tag ${offer.applicable === 'interior' ? 'limited' : ''}" onclick="window.location.href='shop.html?category=${offer.applicable === 'all' ? 'all' : offer.applicable}'" style="cursor: pointer;">${offer.applicable === 'all' ? 'Site Wide' : offer.applicable.charAt(0).toUpperCase() + offer.applicable.slice(1)}</div>
                <div class="offer-body">
                    <h3 class="offer-title">${offer.title}</h3>
                    <div class="offer-discount">${discountText}</div>
                    <p class="offer-validity">${validity}</p>
                </div>
                <div class="offer-footer" style="padding: 16px;">
                    <span class="auto-apply-tag">Auto-applied at checkout</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderFeaturedOffer(offer) {
    const container = document.getElementById('featured-offer-container');
    if (!container) return;

    const discountText = offer.discountType === 'percentage' ? `${offer.value}% OFF` : `₹${offer.value} OFF`;
    const validity = offer.endDate
        ? `Valid till ${new Date(offer.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : "Valid for limited time";

    container.innerHTML = `
        <div class="featured-hero-card">
            <div class="featured-content">
                <div class="featured-badge" onclick="window.location.href='shop.html?category=${offer.applicable === 'all' ? 'all' : offer.applicable}'" style="cursor: pointer;">Limited Time Offer - ${offer.applicable === 'all' ? 'Site Wide' : offer.applicable}</div>
                <h2 class="featured-title">${offer.title}</h2>
                <p class="featured-desc">Upgrade your ride with premium parts. Don't miss out on this exclusive deal.</p>
                <div class="featured-discount">${discountText}</div>
                <div class="featured-validity"><i class="far fa-clock"></i> ${validity}</div>
                <button class="featured-cta" onclick="window.location.href='shop.html'">Claim Offer Now <i class="fas fa-arrow-right"></i></button>
            </div>
            <div class="featured-image">
                <img src="${offer.bannerImage || 'assets/default-product.png'}" alt="${offer.title}">
                <div class="featured-glow"></div>
            </div>
        </div>
    `;
}
