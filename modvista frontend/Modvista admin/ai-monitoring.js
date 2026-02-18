document.addEventListener('DOMContentLoaded', () => {
    const aiToggle = document.getElementById('globalAiToggle');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const errorLogBody = document.getElementById('errorLogBody');

    // Toggle Simulation
    aiToggle.addEventListener('change', () => {
        const state = aiToggle.checked ? 'Enabled' : 'Disabled';
        alert(`AI Preview Feature has been globally ${state}.`);

        if (!aiToggle.checked) {
            document.querySelector('.status-active-pulse').style.background = '#ff1f1f';
            document.querySelector('.status-active-pulse').style.boxShadow = '0 0 10px #ff1f1f';
            document.querySelector('.header-right .status-indicator').innerText = 'System Offline';
            document.querySelector('.header-right .status-indicator').style.color = '#ff1f1f';
            document.querySelector('.header-right .status-indicator').style.background = 'rgba(255, 31, 31, 0.1)';
            document.querySelector('.pill-active').innerText = 'Offline';
            document.querySelector('.pill-active').className = 'status-pill pill-offline';
        } else {
            location.reload(); // Simple way to reset states for demo
        }
    });

    // Clear Logs Simulation
    clearLogsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the current error log display?')) {
            errorLogBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 40px;">No recent errors logged.</td></tr>';
        }
    });

    // Mock Real-time Update for Active Sessions
    setInterval(() => {
        const sessionMetric = document.querySelectorAll('.metric-value')[4];
        let current = parseInt(sessionMetric.innerText);
        const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        sessionMetric.innerText = Math.max(0, current + change);
    }, 5000);

    // Random log simulator
    const addMockLog = () => {
        const vehicles = ['SUV', 'Sedan', 'Coupe', 'Truck', 'Hatchback'];
        const errors = ['API Latency Spike', 'Worker Disconnected', 'Invalid Mesh Result'];

        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const user = '#USR-' + Math.floor(1000 + Math.random() * 9000);
        const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        const error = errors[Math.floor(Math.random() * errors.length)];

        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${timestamp}</td>
            <td>${user}</td>
            <td>${vehicle}</td>
            <td class="log-error">${error}</td>
            <td><span class="status-badge status-pending">Warning</span></td>
        `;

        if (errorLogBody.firstChild) {
            errorLogBody.insertBefore(newRow, errorLogBody.firstChild);
        } else {
            errorLogBody.appendChild(newRow);
        }

        // Remove old logs if too many
        if (errorLogBody.children.length > 8) {
            errorLogBody.removeChild(errorLogBody.lastChild);
        }
    };

    // Randomly add logs every 15-30 seconds
    setInterval(() => {
        if (Math.random() > 0.7) addMockLog();
    }, 15000);
});
