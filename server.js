require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // Still useful for song request IDs
const path = require('path');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

// In-memory store for song requests
let songRequests = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Endpoints ---

// Endpoint to submit the song request (called by frontend after Payrexx success redirect)
app.post('/submit-song', (req, res) => {
    const { name, songTitle, reference } = req.body; // 'reference' is our internalRef

    if (!songTitle) {
        return res.status(400).json({ error: "Song title is required." });
    }
    if (!reference) {
        // This reference confirms (weakly) that the submission process was initiated.
        return res.status(400).json({ error: "Payment reference is missing." });
    }

    const newRequest = {
        id: uuidv4(), // Unique ID for the song request itself
        name: name || 'N/A',
        songTitle: songTitle,
        timestamp: new Date(),
        paymentReference: reference // Store the payment reference
    };
    songRequests.push(newRequest);

    console.log("Song request submitted and saved:", newRequest);
    res.status(201).json({ message: 'Song request submitted successfully!', request: newRequest });
});


// --- Admin Panel (remains largely the same) ---
app.get('/admin', (req, res) => {
    const { key } = req.query;
    if (key !== ADMIN_SECRET_KEY) {
        return res.status(403).send('Forbidden: Invalid secret key.');
    }
    const sortedRequests = [...songRequests].sort((a, b) => b.timestamp - a.timestamp);
    res.render('admin', { songRequests: sortedRequests, pageTitle: "Admin - Song Requests" });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin?key=${ADMIN_SECRET_KEY}`);
});