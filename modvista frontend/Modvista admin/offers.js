
const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === "null" || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? "http://localhost:5000/api"
    : window.location.origin + "/api";
const token = localStorage.getItem("adminToken");

if (!token) {
    window.location.href = "admin-login.html";
}

let editOfferId = null;
let allOffers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Modals
    const createNewBtn = document.getElementById('createNewBtn');
    const offerModal = document.getElementById('offerModal');

    createNewBtn.addEventListener('click', () => {
        resetOfferForm();
        offerModal.classList.add('show');
    });

    document.querySelectorAll('.close-modal, #cancelOffer').forEach(btn => {
        btn.addEventListener('click', () => {
            offerModal.classList.remove('show');
        });
    });

    // Initial load
    fetchOffers();

    // Form submissions
    document.getElementById('offerForm').addEventListener('submit', handleOfferSubmit);

    // Event delegation for dynamic rows
    document.getElementById('offersTbody').addEventListener('click', handleOfferActions);
});

async function fetchOffers() {
    try {
        const res = await fetch(`${API_BASE}/admin/offers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allOffers = data.data;
            renderOffers();
        } else if (res.status === 401 || res.status === 403) {
            handleAuthError();
        }
    } catch (err) {
        console.error(err);
    }
}

function renderOffers() {
    const tbody = document.getElementById('offersTbody');
    tbody.innerHTML = allOffers.map(offer => {
        const discountText = offer.discountType === 'percentage' ? `${offer.value}%` : `₹${offer.value}`;
        const startDate = offer.startDate ? new Date(offer.startDate).toLocaleDateString() : '';
        const endDate = offer.endDate ? new Date(offer.endDate).toLocaleDateString() : '';
        const validity = (startDate || endDate) ? `${startDate} - ${endDate}` : 'Always';

        return `
            <tr>
                <td style="font-weight: 500;">${offer.title}</td>
                <td style="text-transform: capitalize;">${offer.discountType}</td>
                <td style="text-transform: capitalize;">${offer.applicable}</td>
                <td style="color: var(--accent); font-weight: 600;">${discountText}</td>
                <td style="font-size: 0.85rem;">${validity}</td>
                <td><span class="status-badge status-${offer.isActive ? 'active' : 'disabled'}">${offer.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <i class="fas fa-pencil-alt edit-offer" data-id="${offer._id}" style="cursor: pointer; color: var(--text-dim);" title="Edit"></i>
                        <label class="switch">
                            <input type="checkbox" class="toggle-offer" data-id="${offer._id}" ${offer.isActive ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <i class="fas fa-trash-alt delete-offer" data-id="${offer._id}" style="cursor: pointer; color: var(--status-cancelled);" title="Delete"></i>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleOfferSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
        title: formData.get('title'),
        discountType: formData.get('type'),
        value: Number(formData.get('value')),
        bannerImage: formData.get('bannerImage'),
        applicable: formData.get('applicable'),
        startDate: formData.get('start_date') || null,
        endDate: formData.get('end_date') || null,
        autoApply: formData.get('auto_apply') === 'on'
    };

    const url = editOfferId ? `${API_BASE}/admin/offers/${editOfferId}` : `${API_BASE}/admin/offers`;
    const method = editOfferId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Offer ${editOfferId ? 'updated' : 'created'} successfully!`);
            document.getElementById('offerModal').classList.remove('show');
            fetchOffers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleOfferActions(e) {
    const target = e.target;
    const id = target.getAttribute('data-id');

    if (target.classList.contains('edit-offer')) {
        const offer = allOffers.find(o => o._id === id);
        fillOfferForm(offer);
    } else if (target.classList.contains('toggle-offer')) {
        toggleStatus(`${API_BASE}/admin/offers/${id}/toggle`, fetchOffers);
    } else if (target.classList.contains('delete-offer')) {
        if (confirm('Are you sure you want to delete this offer?')) {
            deleteResource(`${API_BASE}/admin/offers/${id}`, fetchOffers);
        }
    }
}

async function toggleStatus(url, reloadFn) {
    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message);
            reloadFn();
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteResource(url, reloadFn) {
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast("Resource deleted successfully");
            reloadFn();
        }
    } catch (err) {
        console.error(err);
    }
}

function handleAuthError() {
    alert("Session expired. Please login again.");
    localStorage.removeItem("adminToken");
    window.location.href = "admin-login.html";
}

function showToast(msg) {
    const toast = document.getElementById('successToast');
    const text = document.getElementById('toastMessage');
    text.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function fillOfferForm(offer) {
    editOfferId = offer._id;
    const form = document.getElementById('offerForm');
    form.title.value = offer.title;
    form.type.value = offer.discountType;
    form.value.value = offer.value;
    form.bannerImage.value = offer.bannerImage || '';
    form.applicable.value = offer.applicable;
    form.start_date.value = offer.startDate ? offer.startDate.split('T')[0] : '';
    form.end_date.value = offer.endDate ? offer.endDate.split('T')[0] : '';
    form.auto_apply.checked = offer.autoApply;

    document.getElementById('offerModalTitle').textContent = 'Edit Offer';
    document.getElementById('saveOfferBtn').disabled = false;
    document.getElementById('offerModal').classList.add('show');
}

function resetOfferForm() {
    editOfferId = null;
    document.getElementById('offerForm').reset();
    document.getElementById('offerModalTitle').textContent = 'Create New Offer';
}

document.getElementById('offerForm').addEventListener('input', () => {
    const title = document.querySelector('[name="title"]').value;
    const value = document.querySelector('[name="value"]').value;
    document.getElementById('saveOfferBtn').disabled = !(title && value);
});
