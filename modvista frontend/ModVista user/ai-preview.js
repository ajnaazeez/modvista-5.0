/* ========================================
   MODVISTA AI PREVIEW
   AI-Powered Car Modification Preview
   ======================================== */

// Mock modification data
const MODIFICATIONS = [
    {
        id: 'led-headlights',
        name: 'Performance LED Headlights',
        category: 'Headlights',
        price: 1899,
        icon: 'fa-lightbulb'
    },
    {
        id: 'alloy-wheels',
        name: 'Forged Carbon Rims V12',
        category: 'Alloy Wheels',
        price: 2499,
        icon: 'fa-circle-notch'
    },
    {
        id: 'body-kit',
        name: 'Aerodynamic Body Kit',
        category: 'Body Kits',
        price: 1250,
        icon: 'fa-car'
    },
    {
        id: 'spoiler',
        name: 'Carbon Fiber GT Wing',
        category: 'Spoilers',
        price: 850,
        icon: 'fa-sort-up'
    },
    {
        id: 'interior',
        name: 'Racing Seat - Alcantara',
        category: 'Interior',
        price: 1695,
        icon: 'fa-couch'
    }
];

// State
let uploadedImage = null;
let selectedMod = MODIFICATIONS[0];

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadBtn = document.getElementById('upload-btn');
    const carImageInput = document.getElementById('car-image-input');
    const uploadCard = document.getElementById('upload-card');
    const selectedModCard = document.getElementById('selected-mod-card');
    const modOptionsScroll = document.getElementById('mod-options-scroll');
    const previewCanvas = document.getElementById('preview-canvas');
    const emptyPreview = document.getElementById('empty-preview');
    const previewImage = document.getElementById('preview-image');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const resetPreviewBtn = document.getElementById('reset-preview-btn');

    // Initialize
    renderModOptions();
    updateSelectedModDisplay();

    // Load selected vehicle if coming from Saved Vehicles
    loadSelectedVehicle();

    // Upload Button Click
    uploadBtn.addEventListener('click', () => {
        carImageInput.click();
    });

    // File Input Change
    carImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file);
        }
    });

    // Drag and Drop
    uploadCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadCard.style.borderColor = 'white';
    });

    uploadCard.addEventListener('dragleave', () => {
        uploadCard.style.borderColor = 'var(--neon-red)';
    });

    uploadCard.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadCard.style.borderColor = 'var(--neon-red)';

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });

    // Reset Preview
    resetPreviewBtn.addEventListener('click', () => {
        if (confirm('Reset the AI preview? This will remove the uploaded image.')) {
            resetPreview();
        }
    });

    // Add to Cart
    addToCartBtn.addEventListener('click', () => {
        if (!uploadedImage) return;

        // Add selected modification to cart
        const cartItem = {
            id: selectedMod.id,
            name: selectedMod.name,
            price: selectedMod.price,
            image: 'assets/Gemini_Generated_Image_6zz6za6zz6za6zz6.png', // Placeholder
            variant: 'Default',
            quantity: 1
        };

        addToCart(cartItem.id, cartItem);
        showToast('Modification added to cart!', 'success');
    });

    // Render Modification Options
    function renderModOptions() {
        modOptionsScroll.innerHTML = '';

        MODIFICATIONS.forEach(mod => {
            const item = document.createElement('div');
            item.className = `mod-option-item ${mod.id === selectedMod.id ? 'active' : ''}`;

            item.innerHTML = `
                <div class="mod-option-icon">
                    <i class="fas ${mod.icon}"></i>
                </div>
                <div class="mod-option-info">
                    <h5>${mod.name}</h5>
                    <p>₹${mod.price.toLocaleString()}</p>
                </div>
            `;

            item.addEventListener('click', () => {
                selectModification(mod);
            });

            modOptionsScroll.appendChild(item);
        });
    }

    // Select Modification
    function selectModification(mod) {
        selectedMod = mod;
        renderModOptions();
        updateSelectedModDisplay();

        // If image uploaded, trigger new preview
        if (uploadedImage) {
            applyAIPreview();
        }
    }

    // Update Selected Mod Display
    function updateSelectedModDisplay() {
        document.getElementById('selected-mod-name').textContent = selectedMod.name;
        document.getElementById('selected-mod-price').textContent = `₹${selectedMod.price.toLocaleString()}`;
    }

    // Load Selected Vehicle
    function loadSelectedVehicle() {
        const vehicleData = localStorage.getItem('selectedVehicleForPreview');
        if (vehicleData) {
            const vehicle = JSON.parse(vehicleData);
            // Show vehicle info in upload card
            const uploadCard = document.getElementById('upload-card');
            const vehicleInfo = document.createElement('div');
            vehicleInfo.className = 'selected-vehicle-info';
            vehicleInfo.innerHTML = `
                <div style="background: rgba(255, 31, 31, 0.1); border: 1px solid var(--neon-red); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <i class="fas fa-car" style="color: var(--neon-red);"></i>
                        <strong style="font-size: 0.95rem;">${vehicle.make} ${vehicle.model}</strong>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${vehicle.year} • ${vehicle.variant || 'Standard'}
                    </div>
                </div>
            `;
            uploadCard.insertBefore(vehicleInfo, uploadCard.firstChild);
        }
    }

    // Handle Image Upload
    function handleImageUpload(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            uploadedImage = e.target.result;

            // Show selected mod card
            selectedModCard.style.display = 'block';

            // Apply AI Preview
            applyAIPreview();
        };

        reader.readAsDataURL(file);
    }

    // Apply AI Preview with Cinematic Scanning Animation
    function applyAIPreview() {
        // Hide empty state
        emptyPreview.style.display = 'none';

        // Show scanning overlay
        const scanningOverlay = document.getElementById('ai-scanning-overlay');
        const scanningBgImage = document.getElementById('scanning-bg-image');
        const scanStatusText = document.getElementById('scan-status-text');

        scanningOverlay.style.display = 'block';
        scanningBgImage.src = uploadedImage;
        previewImage.style.display = 'none';

        // Disable interactions
        addToCartBtn.disabled = true;

        // Status text sequence
        const statusSequence = [
            { text: 'Analyzing vehicle...', delay: 0 },
            { text: 'Mapping surfaces...', delay: 1200 },
            { text: 'Applying modification...', delay: 2200 }
        ];

        statusSequence.forEach(status => {
            setTimeout(() => {
                scanStatusText.textContent = status.text;
            }, status.delay);
        });

        // Complete animation after 3 seconds
        setTimeout(() => {
            // Hide scanning overlay
            scanningOverlay.style.display = 'none';

            // Show final preview
            previewImage.src = uploadedImage;
            previewImage.style.display = 'block';

            // Enable add to cart
            addToCartBtn.disabled = false;

            // Show completion effect
            showCompletionEffect();
            showToast('AI Preview ready!', 'success');
        }, 3000);
    }

    // Show completion effect
    function showCompletionEffect() {
        previewImage.style.animation = 'pulseGlow 0.8s ease';

        setTimeout(() => {
            previewImage.style.animation = '';
        }, 800);
    }

    // Reset Preview
    function resetPreview() {
        uploadedImage = null;
        carImageInput.value = '';

        // Hide preview and scanning
        previewImage.style.display = 'none';
        previewImage.src = '';
        document.getElementById('ai-scanning-overlay').style.display = 'none';

        // Show empty state
        emptyPreview.style.display = 'block';

        // Hide selected mod card
        selectedModCard.style.display = 'none';

        // Disable add to cart
        addToCartBtn.disabled = true;
    }

    // Toast Notification
    function showToast(message, type = 'normal') {
        const toast = document.createElement('div');
        toast.className = 'cart-toast show';

        const iconClass = type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${iconClass}"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // Add to Cart Helper (interfaces with cart-script.js)
    function addToCart(id, item) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];

        const existingItem = cart.find(c => c.id === id);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push(item);
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('storage'));
    }
});
