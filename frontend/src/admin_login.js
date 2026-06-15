import { fetchApi } from './config.js';
import './styles.css';

// Check if already logged in
(async () => {
    try {
        const status = await fetchApi('/login.php');
        if (status.logged_in) {
            window.location.href = '/admin/index.html';
        }
    } catch (e) {
        // Ignore error
    }
})();

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const alertBox = document.getElementById('alert-box');

    try {
        await fetchApi('/login.php', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        window.location.href = '/admin/index.html';
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});

// Auto-fill test credentials
document.getElementById('auto-fill-btn')?.addEventListener('click', () => {
    document.getElementById('username').value = 'admin';
    document.getElementById('password').value = '123456';
});
