$(document).ready(function() { // Use jQuery's ready function as Payrexx scripts use jQuery
    const songRequestForm = $('#songRequestForm');
    const payButton = $('#payButton');
    const messageArea = $('#messageArea');
    const nameInput = $('#name');
    const songTitleInput = $('#songTitle');

    const PAYREXX_BASE_URL = "https://dj-n744.payrexx.com/pay?tid=ec96356d"; // Your base Payrexx link

    // Initialize Payrexx Modal on elements with the class
    // This should be called after the element exists in the DOM
    $(".btn-payrexx-modal").payrexxModal();

    // Handle click on the Payrexx button
    payButton.on('click', function(e) {
        messageArea.html('').removeClass('message-success message-error'); // Clear previous messages

        const name = nameInput.val().trim();
        const songTitle = songTitleInput.val().trim();

        if (!songTitle) {
            e.preventDefault(); // Stop the link from being followed / modal opening
            showMessage('Song title is required.', 'error');
            songTitleInput.focus();
            return;
        }

        // Generate a unique reference for this song request
        const internalRef = generateUUID();

        // Store song details in sessionStorage to retrieve after Payrexx redirect
        const songData = { name: name, songTitle: songTitle, internalRef: internalRef };
        try {
            sessionStorage.setItem(internalRef, JSON.stringify(songData));
        } catch (storageError) {
            console.error("Error saving to sessionStorage:", storageError);
            e.preventDefault();
            showMessage('Could not prepare payment. Please try again or enable cookies/storage.', 'error');
            return;
        }
        
        // IMPORTANT: Update the href of the button to include the reference
        // This reference needs to be configured in your Payrexx link settings
        // to be passed back in the success/failure URL.
        const newHref = `${PAYREXX_BASE_URL}&reference=${internalRef}&amount=100&currency=CHF`;
        // Assuming amount=100 (for 1.00 CHF) and currency=CHF are either
        // respected by your Payrexx link or already configured fixed in Payrexx.
        // If your Payrexx link has a fixed amount, you might not need to send amount/currency.
        $(this).attr('href', newHref);

        // Allow the default action (opening modal via Payrexx script) to proceed
        // The payrexxModal() script will handle e.preventDefault() for navigation
        // and open its modal using the (now updated) href.
        showMessage('Redirecting to payment...', 'info');
    });

    // Check for payment status on page load (after redirect from Payrexx)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const prReference = urlParams.get('pr_reference'); // Name of param Payrexx sends back

    if (prReference) {
        // Attempt to clear the query parameters from URL after processing
        // to avoid re-processing on refresh.
        if (window.history.replaceState) {
            const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanURL }, '', cleanURL);
        }

        const storedSongDataJSON = sessionStorage.getItem(prReference);
        sessionStorage.removeItem(prReference); // Clean up sessionStorage

        if (paymentStatus === 'success' && storedSongDataJSON) {
            const songData = JSON.parse(storedSongDataJSON);
            if (songData.internalRef === prReference) {
                submitSongToServer(songData);
            } else {
                console.error("Reference mismatch after payment redirect.");
                showMessage('Payment successful, but there was an issue linking it to your request. Please contact the DJ.', 'error');
            }
        } else if (paymentStatus === 'failed') {
            showMessage('Payment failed or was cancelled. Please try again.', 'error');
        } else if (!storedSongDataJSON && paymentStatus === 'success') {
            showMessage('Payment successful, but request details were lost. Please contact the DJ or try resubmitting.', 'error');
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
                    reference: songData.internalRef // Send the reference too
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Server error ${response.status}`);
            }

            showMessage('Song requested successfully! Thank you.', 'success');
            songRequestForm[0].reset(); // Reset the form
        } catch (error) {
            console.error('Error submitting song to server:', error);
            showMessage(`Error: ${error.message}. Your payment was successful, but the song couldn't be submitted. Please inform the DJ.`, 'error');
        }
    }

    function showMessage(text, type = 'info') {
        messageArea.text(text).removeClass('message-success message-error message-info').addClass(`message-${type}`);
    }

    function generateUUID() { // Simple UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
});