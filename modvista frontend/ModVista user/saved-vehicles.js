/* ========================================
   SAVED VEHICLES PAGE
   Vehicle Management System (Backend Connected)
   ======================================== */

// Note: apiFetch is globally available from script.js

let vehicles = [];
let deleteVehicleId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const vehiclesGrid = document.getElementById('vehicles-grid');
    const emptyVehicles = document.getElementById('empty-vehicles');
    const vehicleModal = document.getElementById('vehicle-modal');
    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    const vehicleForm = document.getElementById('vehicle-form');
    const addVehicleBtn = document.getElementById('add-vehicle-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelFormBtn = document.getElementById('cancel-form');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');

    // Initial load from backend
    await loadVehicles();

    // Event Listeners
    addVehicleBtn.addEventListener('click', () => openVehicleModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelFormBtn.addEventListener('click', closeModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', deleteVehicle);

    vehicleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveVehicle();
    });

    // Close modals on outside click
    vehicleModal.addEventListener('click', (e) => {
        if (e.target === vehicleModal) closeModal();
    });

    confirmDeleteModal.addEventListener('click', (e) => {
        if (e.target === confirmDeleteModal) closeDeleteModal();
    });

    // Functions
    async function loadVehicles() {
        try {
            const data = await apiFetch('/api/vehicles');
            if (data.success) {
                vehicles = data.vehicles;
                renderVehicles();
            }
        } catch (err) {
            console.error('Failed to load vehicles:', err);
            showToast('Failed to load vehicles', 'error');
        }
    }

    function renderVehicles() {
        if (vehicles.length === 0) {
            vehiclesGrid.style.display = 'none';
            emptyVehicles.style.display = 'flex';
            return;
        }

        vehiclesGrid.style.display = 'grid';
        emptyVehicles.style.display = 'none';
        vehiclesGrid.innerHTML = '';

        vehicles.forEach(vehicle => {
            const card = createVehicleCard(vehicle);
            vehiclesGrid.appendChild(card);
        });
    }

    function createVehicleCard(vehicle) {
        const card = document.createElement('div');
        card.className = `vehicle-card ${vehicle.isDefault ? 'default' : ''}`;

        card.innerHTML = `
            ${vehicle.isDefault ? '<div class="default-badge">DEFAULT</div>' : ''}
            
            <div class="vehicle-icon-wrapper">
                <i class="fas fa-car-side"></i>
            </div>

            <div class="vehicle-info">
                <h3>${vehicle.make} ${vehicle.model}</h3>
                <div class="vehicle-details">
                    <span><i class="fas fa-calendar"></i>${vehicle.year}</span>
                    ${vehicle.variant ? `<span><i class="fas fa-cog"></i>${vehicle.variant}</span>` : ''}
                    ${vehicle.color ? `<span><i class="fas fa-palette"></i>${vehicle.color}</span>` : ''}
                </div>
            </div>

            <div class="vehicle-actions">
                <button class="action-btn primary" onclick="useForAIPreview('${vehicle._id}')">
                    <i class="fas fa-magic"></i>
                    Use for AI Preview
                </button>
                <button class="action-btn" onclick="editVehicle('${vehicle._id}')">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                ${!vehicle.isDefault ? `
                <button class="action-btn" onclick="setDefaultVehicle('${vehicle._id}')">
                    <i class="fas fa-star"></i>
                    Set Default
                </button>
                ` : ''}
                <button class="action-btn danger" onclick="openDeleteModal('${vehicle._id}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        `;

        return card;
    }

    window.openVehicleModal = function (vehicle = null) {
        vehicleModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (vehicle) {
            // Edit mode
            document.getElementById('modal-title').textContent = 'Edit Vehicle';
            document.getElementById('edit-vehicle-id').value = vehicle._id;
            document.getElementById('vehicle-make').value = vehicle.make;
            document.getElementById('vehicle-model').value = vehicle.model;
            document.getElementById('vehicle-year').value = vehicle.year;
            document.getElementById('vehicle-variant').value = vehicle.variant || '';
            document.getElementById('vehicle-color').value = vehicle.color || '';
            document.getElementById('set-default-vehicle').checked = vehicle.isDefault;
        } else {
            // Add mode
            document.getElementById('modal-title').textContent = 'Add New Vehicle';
            vehicleForm.reset();
            document.getElementById('edit-vehicle-id').value = '';
        }
    };

    function closeModal() {
        vehicleModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        vehicleForm.reset();
    }

    async function saveVehicle() {
        const editId = document.getElementById('edit-vehicle-id').value;
        const isDefault = document.getElementById('set-default-vehicle').checked;

        const vehicleData = {
            make: document.getElementById('vehicle-make').value.trim(),
            model: document.getElementById('vehicle-model').value.trim(),
            year: parseInt(document.getElementById('vehicle-year').value),
            variant: document.getElementById('vehicle-variant').value.trim(),
            color: document.getElementById('vehicle-color').value.trim(),
            isDefault: isDefault
        };

        try {
            let res;
            if (editId) {
                // Update existing
                res = await apiFetch(`/api/vehicles/${editId}`, {
                    method: 'PUT',
                    body: JSON.stringify(vehicleData)
                });
            } else {
                // Add new
                res = await apiFetch('/api/vehicles', {
                    method: 'POST',
                    body: JSON.stringify(vehicleData)
                });
            }

            if (res.success) {
                showToast(res.message, 'success');
                await loadVehicles();
                closeModal();
            } else {
                showToast(res.message || 'Failed to save vehicle', 'error');
            }
        } catch (err) {
            console.error('Save vehicle error:', err);
            showToast('Connection error', 'error');
        }
    }

    window.editVehicle = function (id) {
        const vehicle = vehicles.find(v => v._id === id);
        if (vehicle) {
            openVehicleModal(vehicle);
        }
    };

    window.useForAIPreview = function (id) {
        const vehicle = vehicles.find(v => v._id === id);
        if (vehicle) {
            // Store selected vehicle for AI Preview (Can keep in localStorage for immediate sync with AI page)
            localStorage.setItem('selectedVehicleForPreview', JSON.stringify(vehicle));
            window.location.href = 'ai-preview.html';
        }
    };

    window.setDefaultVehicle = async function (id) {
        try {
            const res = await apiFetch(`/api/vehicles/${id}/default`, {
                method: 'PATCH'
            });
            if (res.success) {
                await loadVehicles();
                showToast('Default vehicle updated', 'success');
            }
        } catch (err) {
            showToast('Failed to update default vehicle', 'error');
        }
    };

    window.openDeleteModal = function (id) {
        const vehicle = vehicles.find(v => v._id === id);

        if (vehicle && vehicle.isDefault && vehicles.length > 1) {
            showToast('Cannot delete default vehicle. Set another vehicle as default first.', 'error');
            return;
        }

        deleteVehicleId = id;
        confirmDeleteModal.classList.add('active');
    };

    function closeDeleteModal() {
        confirmDeleteModal.classList.remove('active');
        deleteVehicleId = null;
    }

    async function deleteVehicle() {
        if (!deleteVehicleId) return;

        try {
            const res = await apiFetch(`/api/vehicles/${deleteVehicleId}`, {
                method: 'DELETE'
            });
            if (res.success) {
                showToast('Vehicle deleted successfully', 'success');
                await loadVehicles();
                closeDeleteModal();
            }
        } catch (err) {
            showToast('Failed to delete vehicle', 'error');
        }
    }

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
});
