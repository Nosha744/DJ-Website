// admin.js

document.addEventListener('DOMContentLoaded', () => {
    const requestList = document.getElementById('request-list');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const messageArea = document.getElementById('message-area');
    let sortable;

    if (requestList) {
        sortable = new Sortable(requestList, {
            animation: 150,
            handle: 'tr',
            filter: '.status-played', // Do not allow dragging 'played' items
            onEnd: () => {
                saveOrderBtn.style.display = 'inline-block';
            }
        });
    }

    requestList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-played')) {
            const button = e.target;
            button.disabled = true; // Prevent double clicks
            const songId = button.dataset.id;
            
            try {
                const response = await fetch(`/admin/mark-played/${songId}`, {
                    method: 'POST',
                });
                if (response.ok) {
                    const row = button.closest('tr');
                    row.classList.remove('status-pending');
                    row.classList.add('status-played');
                    row.querySelector('.status-badge').textContent = 'played';
                    button.remove(); // Remove the button entirely
                    showMessage('Song marked as played.', 'success');
                } else {
                   const result = await response.json();
                   showMessage(result.message || 'Failed to update song status.', 'error');
                   button.disabled = false;
                }
            } catch (error) {
                console.error('Error marking song as played:', error);
                showMessage('An error occurred.', 'error');
                button.disabled = false;
            }
        }
    });

    saveOrderBtn.addEventListener('click', async () => {
        const order = sortable.toArray();
        saveOrderBtn.disabled = true;
        saveOrderBtn.textContent = 'Saving...';
        
        try {
            const response = await fetch('/admin/update-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order }),
            });
            if (response.ok) {
                showMessage('Queue order saved successfully!', 'success');
                saveOrderBtn.style.display = 'none';
            } else {
                const result = await response.json();
                showMessage(result.message || 'Failed to save order.', 'error');
            }
        } catch (error) {
            console.error('Error saving order:', error);
            showMessage('An error occurred while saving the order.', 'error');
        } finally {
            saveOrderBtn.disabled = false;
            saveOrderBtn.textContent = 'Save Order';
        }
    });

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = `message ${type}`;
        setTimeout(() => { messageArea.textContent = ''; messageArea.className = 'message'; }, 4000);
    }
});
