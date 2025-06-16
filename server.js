// server.js
// All files (html, css, js) are in the root folder.

require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "3233";

// In-memory store for song requests.
// This data is lost when the server restarts.
let songRequests = [];
let orderCounter = 0; // To maintain a default order

// --- Middleware Setup ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// **CHANGE**: Serve static files from the root directory
app.use(express.static(__dirname));

// **CHANGE**: Look for .ejs view templates in the root directory
app.set('view engine', 'ejs');
app.set('views', __dirname);

// Session middleware for admin login
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key-for-dj-app',
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
        .filter(req => req.status === 'pending')
        .sort((a, b) => a.order - b.order)
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

    // Prevent duplicate submissions with the same payment reference
    const existingRequest = songRequests.find(r => r.paymentReference === reference);
    if (existingRequest) {
        console.log("Duplicate song submission attempt blocked for reference:", reference);
        return res.status(409).json({ error: "This payment has already been used for a song request." });
    }

    const newRequest = {
        id: uuidv4(),
        name: name || 'Anonymous', // Default to Anonymous if name is empty
        songTitle: songTitle,
        timestamp: new Date(),
        paymentReference: reference,
        status: 'pending', // 'pending', 'played'
        order: orderCounter++
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

    const requestMap = new Map(songRequests.map(r => [r.id, r]));
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
    console.log(`Public page: http://localhost:${PORT}/index.html`);
    console.log(`Admin login: http://localhost:${PORT}/admin/login`);
});
