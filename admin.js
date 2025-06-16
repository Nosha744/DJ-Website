// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const requestList = document.getElementById('request-list');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const messageArea = document.getElementById('message-area');
    let sortable;

    // Initialize SortableJS for drag-and-drop
    if (requestList) {
        sortable = new Sortable(requestList, {
            animation: 150,
            handle: 'tr', // Allow dragging the entire row
            filter: '.status-played', // Do not allow dragging 'played' items
            onEnd: () => {
                saveOrderBtn.style.display = 'inline-block'; // Show the save button after a change
            }
        });
    }

    // Event listener for "Mark as Played" buttons
    requestList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-played')) {
            const songId = e.target.dataset.id;
            try {
                const response = await fetch(`/admin/mark-played/${songId}`, {
                    method: 'POST',
                });
                if (response.ok) {
                    // Visually update the row without a full page reload
                    const row = e.target.closest('tr');
                    row.classList.remove('status-pending');
                    row.classList.add('status-played');
                    row.querySelector('.status-badge').textContent = 'played';
                    e.target.remove(); // Remove the button
                    showMessage('Song marked as played.', 'success');
                } else {
                   showMessage('Failed to update song status.', 'error');
                }
            } catch (error) {
                console.error('Error marking song as played:', error);
                showMessage('An error occurred.', 'error');
            }
        }
    });

    // Event listener for the "Save Order" button
    saveOrderBtn.addEventListener('click', async () => {
        const order = sortable.toArray(); // Gets an array of the data-id attributes
        try {
            const response = await fetch('/admin/update-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order }),
            });
            if (response.ok) {
                showMessage('Queue order saved successfully!', 'success');
                saveOrderBtn.style.display = 'none'; // Hide button after saving
            } else {
                showMessage('Failed to save order.', 'error');
            }
        } catch (error) {
            console.error('Error saving order:', error);
            showMessage('An error occurred while saving the order.', 'error');
        }
    });

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = `message ${type}`;
        setTimeout(() => { messageArea.textContent = ''; messageArea.className = 'message'; }, 4000);
    }
});