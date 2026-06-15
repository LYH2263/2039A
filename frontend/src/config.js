export const API_BASE_URL = 'http://localhost:8000/api';

export async function fetchApi(endpoint, options = {}) {
    options.credentials = 'include'; // For sessions
    options.headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    // Handle 401 Unauthorized globally if needed, or let caller handle
    if (response.status === 401) {
        // Redirect to login if in admin area
        if (window.location.pathname.includes('/admin/')) {
            window.location.href = '/admin/login.html';
        }
    }

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    
    return data;
}

export function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}
