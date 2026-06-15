import { notificationManager } from './notifications.js';

export function renderHeader(activeLink = '') {
    const nav = document.createElement('nav');
    nav.className = 'navbar navbar-expand-lg navbar-light bg-white mb-4 shadow-sm';
    nav.innerHTML = `
        <div class="container">
            <a class="navbar-brand" href="/">极简论坛</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto align-items-lg-center">
                    <li class="nav-item"><a class="nav-link ${activeLink === 'home' ? 'active' : ''}" href="/">首页</a></li>
                    <li class="nav-item"><a class="nav-link ${activeLink === 'tags' ? 'active' : ''}" href="/tags.html">标签云</a></li>
                    <li class="nav-item"><a class="nav-link ${activeLink === 'create' ? 'active' : ''}" href="/create_post.html">发布新帖</a></li>
                    <li class="nav-item nav-item-notification" id="nav-notification-wrapper"></li>
                    <li class="nav-item"><a class="nav-link" href="/admin/index.html">后台管理</a></li>
                </ul>
            </div>
        </div>
    `;
    document.body.prepend(nav);

    const notifWrapper = document.getElementById('nav-notification-wrapper');
    if (notifWrapper) {
        notificationManager.renderDropdown(notifWrapper);
        
        notificationManager.subscribe((state) => {
            const wrapper = document.getElementById('nav-notification-wrapper');
            if (wrapper) {
                const dropdown = wrapper.querySelector('#notification-dropdown');
                if (dropdown && dropdown.style.display !== 'none') {
                    notificationManager.renderDropdown(wrapper);
                    const newDropdown = wrapper.querySelector('#notification-dropdown');
                    if (newDropdown) {
                        newDropdown.style.display = 'block';
                    }
                } else {
                    const badge = wrapper.querySelector('.notification-badge');
                    if (state.unreadCount > 0) {
                        if (!badge) {
                            const toggleBtn = wrapper.querySelector('#notification-toggle');
                            if (toggleBtn) {
                                const displayCount = state.unreadCount > 99 ? '99+' : state.unreadCount;
                                toggleBtn.innerHTML = `<i class="bi bi-bell"></i><span class="notification-badge">${displayCount}</span>`;
                            }
                        } else {
                            const displayCount = state.unreadCount > 99 ? '99+' : state.unreadCount;
                            badge.textContent = displayCount;
                        }
                    } else {
                        if (badge) {
                            badge.remove();
                        }
                    }
                }
            }
        });

        if (notificationManager.nickname) {
            notificationManager.startPolling();
        }
    }
}
