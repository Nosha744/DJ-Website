// script.js

$(document).ready(function() {
    const songRequestForm = $('#songRequestForm');
    const payButton = $('#payButton'); // This now correctly selects the button
    const messageArea = $('#messageArea');
    const nameInput = $('#name');
    const songTitleInput = $('#songTitle');
    const publicQueueList = $('#public-queue-list');

    const PAYREXX_BASE_URL = "https://dj-n744.payrexx.com/pay?tid=ec96356d";

    // Initialize the Payrexx modal functionality on the button
    payButton.payrexxModal();

    // **** FIX: This click handler now correctly modifies the link before the Payrexx modal opens ****
    payButton.on('click', function(e) {
        messageArea.html('').removeClass('message-success message-error message-info');

        const name = nameInput.val().trim();
        const songTitle = songTitleInput.val().trim();

        if (!songTitle) {
            e.preventDefault(); // Stop the link from being followed
            e.stopImmediatePropagation(); // Stop other scripts (like Payrexx's modal) from running
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
            e.stopImmediatePropagation();
            showMessage('Could not prepare payment. Please try again.', 'error');
            return;
        }
        
        const newHref = `${PAYREXX_BASE_URL}&reference=${internalRef}&amount=100¤cy=CHF`;
        $(this).attr('href', newHref);
    });

    // --- Check for payment status on page load ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const prReference = urlParams.get('pr_reference');

    if (prReference) {
        // Clean the URL to prevent re-submission on refresh
        if (window.history.replaceState) {
            const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanURL }, '', cleanURL);
        }

        const storedSongDataJSON = sessionStorage.getItem(prReference);
        sessionStorage.removeItem(prReference); // Clean up immediately

        if (paymentStatus === 'success' && storedSongDataJSON) {
            const songData = JSON.parse(storedSongDataJSON);
            if (songData.internalRef === prReference) {
                submitSongToServer(songData);
            } else {
                showMessage('Payment successful, but there was a reference mismatch.', 'error');
            }
        } else if (paymentStatus === 'failed') {
            showMessage('Payment failed or was cancelled.', 'error');
        } else if (!storedSongDataJSON && paymentStatus === 'success') {
            showMessage('Payment successful, but request details were lost. Please contact the DJ.', 'error');
        }
    }
    
    async function submitSongToServer(songData) {
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
            fetchPublicQueue(); // Refresh queue immediately
        } catch (error) {
            console.error('Error submitting song to server:', error);
            showMessage(`Error: ${error.message}. Your payment was successful, but the song couldn't be auto-submitted. Please notify the DJ.`, 'error');
        }
    }
    
    async function fetchPublicQueue() {
        try {
            const response = await fetch('/api/queue');
            if (!response.ok) throw new Error('Could not fetch queue.');
            const queue = await response.json();
            renderPublicQueue(queue);
        } catch (error) {
            console.error('Error fetching public queue:', error);
            publicQueueList.html('<li class="empty">Could not load queue.</li>');
        }
    }

    function renderPublicQueue(queue) {
        publicQueueList.empty();
        if (queue.length === 0) {
            publicQueueList.append('<li class="empty">The queue is currently empty. Be the first!</li>');
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
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
    
    function showMessage(text, type = 'info') {
        messageArea.text(text).removeClass('message-success message-error message-info').addClass(`message-${type}`);
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    fetchPublicQueue();
    setInterval(fetchPublicQueue, 15000);
});
