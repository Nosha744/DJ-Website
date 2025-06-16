// server.js

require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const ADMIN_PASSWORD = "3233"; // The admin password as requested

// In-memory store for song requests.
// IMPORTANT: This data is lost when the server restarts.
let songRequests = [];
let orderCounter = 0; // To maintain a default order

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for form submissions (login)
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session middleware for admin login
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key', // Use an env variable for this in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to protect admin routes
const checkAuth = (req, res, next) => {
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
};

// --- PUBLIC ENDPOINTS ---

// API endpoint for the public to get the current song queue
app.get('/api/queue', (req, res) => {
    const publicQueue = songRequests
        .filter(req => req.status === 'pending') // Only show pending songs
        .sort((a, b) => a.order - b.order)       // Sort by the custom order
        .map(req => ({
            name: req.name,
            songTitle: req.songTitle
        }));
    res.json(publicQueue);
});

// Endpoint to submit the song request (from Payrexx redirect)
app.post('/submit-song', (req, res) => {
    const { name, songTitle, reference } = req.body;

    if (!songTitle || !reference) {
        return res.status(400).json({ error: "Song title and payment reference are required." });
    }

    const newRequest = {
        id: uuidv4(),
        name: name || 'N/A',
        songTitle: songTitle,
        timestamp: new Date(),
        paymentReference: reference,
        status: 'pending', // 'pending', 'played'
        order: orderCounter++ // Assign an incremental order
    };
    songRequests.push(newRequest);

    console.log("Song request submitted and saved:", newRequest);
    res.status(201).json({ message: 'Song request submitted successfully!', request: newRequest });
});

// --- ADMIN ENDPOINTS ---

// Admin login page
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

// Handle admin login
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Invalid password. Please try again.' });
    }
});

// Admin dashboard (protected)
app.get('/admin', checkAuth, (req, res) => {
    // Sort requests to show pending ones first, then by their custom order
    const sortedRequests = [...songRequests].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.order - b.order;
    });
    res.render('admin', { songRequests: sortedRequests });
});

// Endpoint to mark a song as played (protected)
app.post('/admin/mark-played/:id', checkAuth, (req, res) => {
    const { id } = req.params;
    const request = songRequests.find(r => r.id === id);
    if (request) {
        request.status = 'played';
        console.log(`Marked song ${request.songTitle} as played.`);
        res.json({ success: true, message: 'Status updated to played.' });
    } else {
        res.status(404).json({ success: false, message: 'Song not found.' });
    }
});

// Endpoint to update the order of songs (protected)
app.post('/admin/update-order', checkAuth, (req, res) => {
    const { order } = req.body; // Expects an array of song IDs
    if (!Array.isArray(order)) {
        return res.status(400).json({ success: false, message: 'Invalid order data.' });
    }

    // Create a map for quick lookups
    const requestMap = new Map(songRequests.map(r => [r.id, r]));

    // Re-assign the 'order' property based on the new array index
    order.forEach((id, index) => {
        const request = requestMap.get(id);
        if (request) {
            request.order = index;
        }
    });

    console.log('Updated song order.');
    res.json({ success: true, message: 'Order updated successfully.' });
});


// Admin logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin login: http://localhost:${PORT}/admin/login`);
});
