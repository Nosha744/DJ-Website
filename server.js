// server.js
require('dotenv').config();
const express = require('express');
const path =path.resolve( './');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');

// --- App and Supabase Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "3233";

// **CHANGE**: Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middleware Setup ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path));
app.set('view engine', 'ejs');
app.set('views', path);

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const checkAuth = (req, res, next) => {
    if (req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
};

// --- PUBLIC ENDPOINTS ---

// API endpoint to get the public queue of pending songs
app.get('/api/queue', async (req, res) => {
    const { data, error } = await supabase
        .from('song_requests')
        .select('name, song_title')
        .eq('status', 'pending')
        .order('queue_order', { ascending: true });

    if (error) {
        console.error('Error fetching queue:', error);
        return res.status(500).json({ error: 'Could not fetch the queue.' });
    }
    res.json(data);
});

// Endpoint to submit a new song request (no payment)
app.post('/submit-song', async (req, res) => {
    const { name, songTitle } = req.body;

    if (!songTitle) {
        return res.status(400).json({ error: "Song title is required." });
    }

    const { data, error } = await supabase
        .from('song_requests')
        .insert([{ name: name || 'Anonymous', song_title: songTitle }])
        .select();

    if (error) {
        console.error('Error inserting song:', error);
        return res.status(500).json({ error: 'Could not submit your request.' });
    }

    console.log("Song request saved to Supabase:", data[0]);
    res.status(201).json({ message: 'Song request submitted successfully!', request: data[0] });
});

// --- ADMIN ENDPOINTS ---

app.get('/admin/login', (req, res) => res.render('login', { error: null }));

app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Invalid password. Please try again.' });
    }
});

// Admin dashboard - fetches all songs from Supabase
app.get('/admin', checkAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('song_requests')
        .select('*')
        .order('status', { ascending: true }) // 'pending' comes before 'played'
        .order('queue_order', { ascending: true });

    if (error) {
        console.error('Error fetching songs for admin:', error);
        return res.status(500).send("Error loading dashboard data.");
    }
    res.render('admin', { songRequests: data || [] });
});

// Mark a song as 'played'
app.post('/admin/mark-played/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('song_requests')
        .update({ status: 'played' })
        .eq('id', id);

    if (error) {
        console.error('Error marking as played:', error);
        return res.status(500).json({ success: false, message: 'Database error.' });
    }
    res.json({ success: true, message: 'Status updated to played.' });
});

// Update the order of songs in the queue
app.post('/admin/update-order', checkAuth, async (req, res) => {
    const { order } = req.body; // Expects an array of song IDs
    if (!Array.isArray(order)) {
        return res.status(400).json({ success: false, message: 'Invalid order data.' });
    }

    const updates = order.map((id, index) => ({
        id: id,
        queue_order: index
    }));

    const { error } = await supabase.from('song_requests').upsert(updates);

    if (error) {
        console.error('Error updating order:', error);
        return res.status(500).json({ success: false, message: 'Failed to save order.' });
    }
    res.json({ success: true, message: 'Order updated successfully.' });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/admin/login'));
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Public page: http://localhost:${PORT}/index.html`);
    console.log(`Admin login: http://localhost:${PORT}/admin/login`);
});
