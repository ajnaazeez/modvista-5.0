document.addEventListener('DOMContentLoaded', () => {
    const getApiBase = () => (window.ModVistaAPI && window.ModVistaAPI.API_BASE) || "http://localhost:5000/api";
    const localApiBase = getApiBase();
    const token = localStorage.getItem('token');

    // Mock Order Data
    const orderData = {
        orderId: 'MV2026849201',
        date: 'Jan 20, 2026',
        totalValue: 2948.82,
        paymentMethod: 'Razorpay (Online)',
        pickupAddress: {
            name: 'Alex Rivera',
            phone: '+1 (555) 123-4567',
            address: '123 Performance Dr, Carbon Valley, CA 90210'
        },
        items: [
            {
                id: 'p1',
                name: 'Forged Carbon Fiber Side Skirts',
                variant: 'Matte Finish',
                price: 1299.00,
                qty: 1,
                image: 'assets/side-skirts.png',
                returnable: true
            },
            {
                id: 'p2',
                name: 'Neon Underglow Kit v2',
                variant: 'RGB App Control',
                price: 499.00,
                qty: 1,
                image: 'assets/underglow.png',
                returnable: true
            },
            {
                id: 'p3',
                name: 'Limited Edition ModVista Decal',
                variant: 'White 10-inch',
                price: 45.00,
                qty: 1,
                image: 'assets/decal.png',
                returnable: false,
                reason: 'Non-returnable accessory'
            }
        ]
    };

    const container = document.getElementById('return-items-container');
    const returnSubtotalEl = document.getElementById('return-subtotal');
    const estRefundEl = document.getElementById('est-refund');
    const submitBtn = document.getElementById('submit-return');
    const confirmCheck = document.getElementById('confirm-check');
    const reasonSelect = document.getElementById('return-reason');
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const previewGrid = document.getElementById('file-preview-grid');
    const successModal = document.getElementById('success-modal');

    let selectedItems = new Map(); // id -> {qty, price}

    // Initialize Page
    function init() {
        renderItems();
        updateSummary();
        if (token) fetchSidebarProfile();
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

    function renderItems() {
        container.innerHTML = '';
        orderData.items.forEach(item => {
            const row = document.createElement('div');
            row.className = `return-item-row ${!item.returnable ? 'disabled' : ''}`;
            row.dataset.id = item.id;

            row.innerHTML = `
                <input type="checkbox" class="item-checkbox" ${!item.returnable ? 'disabled' : ''}>
                <img src="${item.image}" alt="${item.name}" class="item-thumb-small">
                <div class="item-meta">
                    <h3>${item.name}</h3>
                    <p>${item.variant} • $${item.price.toFixed(2)}</p>
                    ${!item.returnable ? `<span class="eligibility-label non-returnable">${item.reason}</span>` : '<span class="eligibility-label eligible">Eligible for return</span>'}
                </div>
                <div class="item-return-actions">
                    ${item.returnable ? `
                        <div class="qty-picker">
                            <button class="qty-btn-small minus"><i class="fas fa-minus"></i></button>
                            <span class="qty-val">1</span>
                            <button class="qty-btn-small plus"><i class="fas fa-plus"></i></button>
                        </div>
                    ` : ''}
                    <span class="return-price">$${item.price.toFixed(2)}</span>
                </div>
            `;

            if (item.returnable) {
                const checkbox = row.querySelector('.item-checkbox');
                const qtyVal = row.querySelector('.qty-val');
                const plusBtn = row.querySelector('.plus');
                const minusBtn = row.querySelector('.minus');

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        row.classList.add('selected');
                        selectedItems.set(item.id, { qty: parseInt(qtyVal.innerText), price: item.price });
                    } else {
                        row.classList.remove('selected');
                        selectedItems.delete(item.id);
                    }
                    updateSummary();
                    validateForm();
                });

                plusBtn.addEventListener('click', () => {
                    let current = parseInt(qtyVal.innerText);
                    if (current < item.qty) {
                        qtyVal.innerText = ++current;
                        if (checkbox.checked) {
                            selectedItems.get(item.id).qty = current;
                            updateSummary();
                        }
                    }
                });

                minusBtn.addEventListener('click', () => {
                    let current = parseInt(qtyVal.innerText);
                    if (current > 1) {
                        qtyVal.innerText = --current;
                        if (checkbox.checked) {
                            selectedItems.get(item.id).qty = current;
                            updateSummary();
                        }
                    }
                });
            }

            container.appendChild(row);
        });
    }

    function updateSummary() {
        let subtotal = 0;
        selectedItems.forEach(val => {
            subtotal += val.qty * val.price;
        });

        returnSubtotalEl.innerText = `$${subtotal.toFixed(2)}`;
        estRefundEl.innerText = `$${subtotal.toFixed(2)}`;
    }

    function validateForm() {
        const hasItems = selectedItems.size > 0;
        const hasReason = reasonSelect.value !== '';
        const isConfirmed = confirmCheck.checked;

        submitBtn.disabled = !(hasItems && hasReason && isConfirmed);
    }

    // Event Listeners
    reasonSelect.addEventListener('change', validateForm);
    confirmCheck.addEventListener('change', validateForm);

    // Upload Logic
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    function handleFiles(files) {
        if (files.length > 3) {
            alert('Max 3 files allowed');
            return;
        }

        previewGrid.innerHTML = '';
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'preview-item';
                    div.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button class="remove-file"><i class="fas fa-times"></i></button>
                    `;
                    div.querySelector('.remove-file').addEventListener('click', () => div.remove());
                    previewGrid.appendChild(div);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Submit Logic
    submitBtn.addEventListener('click', () => {
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            successModal.classList.add('active');
            submitBtn.innerHTML = 'Submit Return Request';
        }, 1500);
    });

    init();
});
