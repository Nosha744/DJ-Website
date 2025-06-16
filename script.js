// public/js/script.js

$(document).ready(function() {
    const songRequestForm = $('#songRequestForm');
    const payButton = $('#payButton');
    const messageArea = $('#messageArea');
    const nameInput = $('#name');
    const songTitleInput = $('#songTitle');
    const publicQueueList = $('#public-queue-list');

    const PAYREXX_BASE_URL = "https://dj-n744.payrexx.com/pay?tid=ec96356d";

    $(".btn-payrexx-modal").payrexxModal();

    payButton.on('click', function(e) {
        // ... (The existing code for the pay button click handler remains exactly the same)
        messageArea.html('').removeClass('message-success message-error');

        const name = nameInput.val().trim();
        const songTitle = songTitleInput.val().trim();

        if (!songTitle) {
            e.preventDefault();
            showMessage('Song title is required.', 'error');
            songTitleInput.focus();
            return;
        }

        const internalRef = generateUUID();
        const songData = { name: name, songTitle: songTitle, internalRef: internalRef };
        try {
            sessionStorage.setItem(internalRef, JSON.stringify(songData));
        } catch (storageError) {
            console.error("Error saving to sessionStorage:", storageError);
            e.preventDefault();
            showMessage('Could not prepare payment. Please try again.', 'error');
            return;
        }
        
        const newHref = `${PAYREXX_BASE_URL}&reference=${internalRef}&amount=100¤cy=CHF`;
        $(this).attr('href', newHref);
        showMessage('Redirecting to payment...', 'info');
    });

    // --- Check for payment status (this part also remains the same) ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const prReference = urlParams.get('pr_reference');

    if (prReference) {
        if (window.history.replaceState) {
            const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanURL }, '', cleanURL);
        }

        const storedSongDataJSON = sessionStorage.getItem(prReference);
        sessionStorage.removeItem(prReference);

        if (paymentStatus === 'success' && storedSongDataJSON) {
            const songData = JSON.parse(storedSongDataJSON);
            if (songData.internalRef === prReference) {
                submitSongToServer(songData);
            } else {
                showMessage('Payment successful, but there was an issue linking it to your request.', 'error');
            }
        } else if (paymentStatus === 'failed') {
            showMessage('Payment failed or was cancelled.', 'error');
        } else if (!storedSongDataJSON && paymentStatus === 'success') {
            showMessage('Payment successful, but request details were lost. Please contact the DJ.', 'error');
        }
    }
    
    async function submitSongToServer(songData) {
        // ... (The existing submitSongToServer function also remains the same, but we add one line)
        showMessage('Payment successful! Submitting your song request...', 'info');
        try {
            const response = await fetch('/submit-song', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: songData.name,
                    songTitle: songData.songTitle,
                    reference: songData.internalRef
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Server error ${response.status}`);
            showMessage('Song requested successfully! Thank you.', 'success');
            songRequestForm[0].reset();
            fetchPublicQueue(); // <-- ADD THIS LINE: Refresh queue immediately after successful submission
        } catch (error) {
            console.error('Error submitting song to server:', error);
            showMessage(`Error: ${error.message}. Your payment was successful, but the song couldn't be submitted.`, 'error');
        }
    }
    
    // --- NEW: Functions for Public Queue ---
    async function fetchPublicQueue() {
        try {
            const response = await fetch('/api/queue');
            if (!response.ok) {
                throw new Error('Could not fetch queue.');
            }
            const queue = await response.json();
            renderPublicQueue(queue);
        } catch (error) {
            console.error('Error fetching public queue:', error);
            publicQueueList.html('<li class="empty">Could not load queue.</li>');
        }
    }

    function renderPublicQueue(queue) {
        publicQueueList.empty(); // Clear the list first
        if (queue.length === 0) {
            publicQueueList.append('<li class="empty">The queue is currently empty. Be the first to request a song!</li>');
        } else {
            queue.forEach(request => {
                const listItem = `
                    <li>
                        <span class="queue-song-title">${escapeHTML(request.songTitle)}</span>
                        <span class="queue-requester-name">Requested by: ${escapeHTML(request.name)}</span>
                    </li>`;
                publicQueueList.append(listItem);
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&', '<': '<', '>': '>',
                "'": ''', '"': '"'
            }[tag] || tag)
        );
    }
    
    function showMessage(text, type = 'info') {
        // ... (This function remains the same)
        messageArea.text(text).removeClass('message-success message-error message-info').addClass(`message-${type}`);
    }

    function generateUUID() {
        // ... (This function remains the same)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Initial fetch of the queue when the page loads
    fetchPublicQueue();

    // Periodically refresh the queue every 15 seconds
    setInterval(fetchPublicQueue, 15000);
});
