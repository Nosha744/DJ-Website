// --- DATA & STATE MANAGEMENT (Simulating a Database) ---
const DB = {
    // Use localStorage to persist the request queue and earnings
    getQueue: () => JSON.parse(localStorage.getItem('djRequestQueue')) || [],
    saveQueue: (queue) => localStorage.setItem('djRequestQueue', JSON.stringify(queue)),

    getEarnings: () => JSON.parse(localStorage.getItem('djEarnings')) || { total: 0, history: [] },
    saveEarnings: (earnings) => localStorage.setItem('djEarnings', JSON.stringify(earnings)),
};

// --- CONFIGURATION ---
const REQUEST_FEE = 0.50;
const DJ_PASSWORD = 'dj123'; // In a real app, this is highly insecure!
const REFRESH_INTERVAL = 3000; // 3 seconds for pseudo-real-time updates

// --- DOM ELEMENTS ---
const views = document.querySelectorAll('.view');
const navButtons = {
    user: document.getElementById('nav-user'),
    public: document.getElementById('nav-public'),
    dj: document.getElementById('nav-dj'),
};

// User View Elements
const songTitleInput = document.getElementById('song-title-input');
const songArtistInput = document.getElementById('song-artist-input');
const requestSongBtn = document.getElementById('request-song-btn');
const requestError = document.getElementById('request-error');

// Public Queue View
const publicQueueList = document.getElementById('public-queue-list');

// DJ Login View
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('dj-password');
const loginError = document.getElementById('login-error');

// DJ Dashboard View
const djQueueList = document.getElementById('dj-queue-list');
const totalEarningsDisplay = document.getElementById('total-earnings');
const earningsChartCanvas = document.getElementById('earnings-chart').getContext('2d');
let earningsChart = null;

// --- VIEW NAVIGATION ---
const showView = (viewId) => {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
    if (viewId.includes('user')) navButtons.user.classList.add('active');
    if (viewId.includes('public')) navButtons.public.classList.add('active');
    if (viewId.includes('dj')) navButtons.dj.classList.add('active');
};

navButtons.user.addEventListener('click', () => showView('user-view'));
navButtons.public.addEventListener('click', () => showView('public-queue-view'));
navButtons.dj.addEventListener('click', () => showView('dj-login-view'));

// --- CORE LOGIC ---

// 1. Handle request from input fields
requestSongBtn.addEventListener('click', () => {
    const title = songTitleInput.value.trim();
    const artist = songArtistInput.value.trim();

    if (!title || !artist) {
        requestError.style.display = 'block';
        return;
    }
    requestError.style.display = 'none';

    const song = { title, artist };
    handleRequest(song);
});

// 2. Handle a Song Request (Simulates Payment)
const handleRequest = (song) => {
    // THIS IS THE TWINT PAYMENT SIMULATION
    const isPaymentSuccessful = confirm(
        `You are requesting "${song.title}" by ${song.artist}.\n\n` +
        `Please confirm to pay ${REQUEST_FEE.toFixed(2)} CHF via Twint.\n\n` +
        `(This is a simulation. No real money will be charged.)`
    );

    if (isPaymentSuccessful) {
        const queue = DB.getQueue();
        const earnings = DB.getEarnings();

        const newRequest = {
            id: Date.now(), // Unique ID for the request
            title: song.title,
            artist: song.artist,
            status: 'paid', // 'paid', 'played', 'skipped'
            timestamp: new Date().toISOString()
        };

        queue.unshift(newRequest); // Add to the top of the queue
        DB.saveQueue(queue);

        // Update earnings
        earnings.total += REQUEST_FEE;
        earnings.history.push({ time: new Date().toISOString(), amount: earnings.total });
        DB.saveEarnings(earnings);

        alert('Payment successful! Your song has been added to the queue.');
        
        // Clear inputs for the next user
        songTitleInput.value = '';
        songArtistInput.value = '';

        // Refresh views
        refreshAllViews();
    } else {
        alert('Payment cancelled. Your song was not requested.');
    }
};

// 3. Public Queue: Render Paid Songs
const renderPublicQueue = () => {
    const queue = DB.getQueue();
    const paidRequests = queue.filter(req => req.status === 'paid' || req.status === 'played');

    publicQueueList.innerHTML = '';
    if (paidRequests.length === 0) {
        publicQueueList.innerHTML = '<li class="queue-item">The request queue is currently empty.</li>';
        return;
    }

    paidRequests.forEach((req, index) => {
        const li = document.createElement('li');
        li.className = 'queue-item';
        li.innerHTML = `
            <div class="song-info">
                <span class="song-title">${index + 1}. ${req.title}</span>
                <span class="song-artist">${req.artist}</span>
            </div>
            <span class="status ${req.status}">${req.status === 'played' ? 'Up Next / Played' : 'In Queue'}</span>
        `;
        publicQueueList.appendChild(li);
    });
};

// 4. DJ Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === DJ_PASSWORD) {
        loginError.style.display = 'none';
        passwordInput.value = '';
        showView('dj-dashboard-view');
        refreshAllViews(); // Make sure dashboard is up to date on login
    } else {
        loginError.style.display = 'block';
    }
});

// 5. DJ Dashboard: Render Full Queue & Manage
const renderDjDashboard = () => {
    const queue = DB.getQueue();
    const earnings = DB.getEarnings();

    totalEarningsDisplay.textContent = `Total: ${earnings.total.toFixed(2)} CHF`;

    djQueueList.innerHTML = '';
    if (queue.length === 0) {
        djQueueList.innerHTML = '<li class="queue-item">No requests yet.</li>';
    } else {
        queue.forEach(req => {
            const li = document.createElement('li');
            li.className = `queue-item status-${req.status}`;
            li.innerHTML = `
                <div class="song-info">
                    <span class="song-title">${req.title}</span>
                    <span class="song-artist">${req.artist}</span>
                </div>
                <div class="dj-controls">
                    <span class="status ${req.status}">${req.status}</span>
                    ${req.status === 'paid' ? `
                    <div class="dj-actions">
                        <button class="action-btn played-btn" data-req-id="${req.id}">Played</button>
                        <button class="action-btn skipped-btn" data-req-id="${req.id}">Skip</button>
                    </div>
                    ` : ''}
                </div>
            `;
            djQueueList.appendChild(li);
        });

        document.querySelectorAll('.played-btn').forEach(btn => 
            btn.addEventListener('click', () => updateRequestStatus(btn.dataset.reqId, 'played'))
        );
        document.querySelectorAll('.skipped-btn').forEach(btn => 
            btn.addEventListener('click', () => updateRequestStatus(btn.dataset.reqId, 'skipped'))
        );
    }

    renderEarningsChart();
};

const updateRequestStatus = (requestId, newStatus) => {
    const queue = DB.getQueue();
    const requestIndex = queue.findIndex(r => r.id == requestId);
    if (requestIndex > -1) {
        queue[requestIndex].status = newStatus;
        DB.saveQueue(queue);
        refreshAllViews();
    }
};

// 6. DJ Dashboard: Render Earnings Chart
const renderEarningsChart = () => {
    const earnings = DB.getEarnings();
    const labels = earnings.history.map(entry => new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const data = earnings.history.map(entry => entry.amount);

    if (earningsChart) {
        earningsChart.data.labels = labels;
        earningsChart.data.datasets[0].data = data;
        earningsChart.update();
    } else {
        earningsChart = new Chart(earningsChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Earnings (CHF)',
                    data: data,
                    borderColor: 'rgba(29, 185, 84, 1)',
                    backgroundColor: 'rgba(29, 185, 84, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }
};

// --- INITIALIZATION & AUTO-REFRESH ---

const refreshAllViews = () => {
    renderPublicQueue();
    if (document.getElementById('dj-dashboard-view').classList.contains('active')) {
        renderDjDashboard();
    }
};

// Initial load and set up interval for refreshing
refreshAllViews();
setInterval(refreshAllViews, REFRESH_INTERVAL);