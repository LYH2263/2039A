import { fetchApi, formatDate, escapeHtml } from './config.js';

const STORAGE_KEY_NICKNAME = 'forum_nickname';
const POLL_INTERVAL = 10000;

class NotificationManager {
    constructor() {
        this.unreadCount = 0;
        this.notifications = [];
        this.pollTimer = null;
        this.isDropdownOpen = false;
        this.listeners = [];
        this.nickname = this.getNickname();
    }

    getNickname() {
        return localStorage.getItem(STORAGE_KEY_NICKNAME) || '';
    }

    setNickname(name) {
        this.nickname = name.trim();
        if (this.nickname) {
            localStorage.setItem(STORAGE_KEY_NICKNAME, this.nickname);
        } else {
            localStorage.removeItem(STORAGE_KEY_NICKNAME);
        }
        this.notifyListeners();
        if (this.nickname) {
            this.startPolling();
            this.fetchNotifications();
        } else {
            this.stopPolling();
            this.unreadCount = 0;
            this.notifications = [];
            this.notifyListeners();
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb({
            unreadCount: this.unreadCount,
            notifications: this.notifications,
            nickname: this.nickname
        }));
    }

    async fetchUnreadCount() {
        if (!this.nickname) return;
        try {
            const data = await fetchApi(`/notifications.php?action=unread_count&recipient=${encodeURIComponent(this.nickname)}`);
            this.unreadCount = data.unread_count || 0;
            this.notifyListeners();
        } catch (err) {
            console.error('Failed to fetch unread count:', err);
        }
    }

    async fetchNotifications(limit = 20) {
        if (!this.nickname) return;
        try {
            const data = await fetchApi(`/notifications.php?recipient=${encodeURIComponent(this.nickname)}&limit=${limit}`);
            this.notifications = data.notifications || [];
            this.unreadCount = data.unread_count || 0;
            this.notifyListeners();
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    }

    async markAsRead(notificationId) {
        if (!this.nickname) return;
        try {
            const data = await fetchApi('/notifications.php', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'read',
                    id: notificationId,
                    recipient: this.nickname
                })
            });
            const notif = this.notifications.find(n => n.id === notificationId);
            if (notif) {
                notif.is_read = true;
            }
            this.unreadCount = data.unread_count || 0;
            this.notifyListeners();
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    }

    async markAllAsRead() {
        if (!this.nickname) return;
        try {
            await fetchApi('/notifications.php', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'read_all',
                    recipient: this.nickname
                })
            });
            this.notifications.forEach(n => n.is_read = true);
            this.unreadCount = 0;
            this.notifyListeners();
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    }

    startPolling() {
        this.stopPolling();
        this.fetchUnreadCount();
        this.pollTimer = setInterval(() => {
            this.fetchUnreadCount();
        }, POLL_INTERVAL);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    renderDropdown(container) {
        if (!this.nickname) {
            container.innerHTML = this.renderNicknamePrompt();
            this.bindNicknameEvents(container);
            return;
        }

        const hasUnread = this.unreadCount > 0;
        const displayCount = this.unreadCount > 99 ? '99+' : this.unreadCount;

        container.innerHTML = `
            <div class="notification-wrapper">
                <button class="nav-link notification-btn" id="notification-toggle" title="通知">
                    <i class="bi bi-bell"></i>
                    ${hasUnread ? `<span class="notification-badge">${displayCount}</span>` : ''}
                </button>
                <div class="notification-dropdown" id="notification-dropdown" style="display: none;">
                    <div class="notification-header">
                        <span>通知</span>
                        <button class="notification-read-all-btn" id="notification-read-all" ${this.unreadCount === 0 ? 'disabled' : ''}>
                            全部已读
                        </button>
                    </div>
                    <div class="notification-list" id="notification-list">
                        ${this.notifications.length === 0 ? 
                            '<div class="notification-empty">暂无通知</div>' : 
                            this.notifications.map(n => this.renderNotificationItem(n)).join('')
                        }
                    </div>
                    <div class="notification-footer">
                        <small class="text-muted">以「${escapeHtml(this.nickname)}」身份接收通知</small>
                        <button class="notification-switch-btn" id="notification-switch">切换昵称</button>
                    </div>
                </div>
            </div>
        `;

        this.bindDropdownEvents(container);
    }

    renderNicknamePrompt() {
        return `
            <div class="notification-wrapper">
                <button class="nav-link notification-btn" id="notification-toggle" title="设置昵称接收通知">
                    <i class="bi bi-bell"></i>
                </button>
                <div class="notification-dropdown" id="notification-dropdown" style="display: none;">
                    <div class="notification-header">
                        <span>设置昵称</span>
                    </div>
                    <div class="notification-nickname-form">
                        <p class="text-muted small mb-2">设置你的昵称，以便接收帖子评论通知</p>
                        <div class="mb-2">
                            <input type="text" class="form-control form-control-sm" id="notification-nickname-input" placeholder="请输入你的昵称">
                        </div>
                        <button class="btn btn-primary btn-sm w-100" id="notification-nickname-submit">
                            确认
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderNotificationItem(notification) {
        const isUnread = !notification.is_read;
        const title = notification.post_title || '（帖子已删除）';
        const commentContent = notification.comment_content || '';
        
        return `
            <div class="notification-item ${isUnread ? 'notification-item-unread' : ''}" 
                 data-id="${notification.id}" 
                 data-post-id="${notification.post_id}">
                <div class="notification-item-header">
                    <strong>${escapeHtml(notification.comment_author || '匿名')}</strong>
                    <span class="notification-item-time">${this.formatRelativeTime(notification.created_at)}</span>
                </div>
                <div class="notification-item-title">
                    评论了你的帖子：${escapeHtml(title)}
                </div>
                <div class="notification-item-content">
                    ${escapeHtml(commentContent)}
                </div>
                ${isUnread ? '<div class="notification-unread-dot"></div>' : ''}
            </div>
        `;
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return formatDate(dateString);
    }

    bindDropdownEvents(container) {
        const toggleBtn = container.querySelector('#notification-toggle');
        const dropdown = container.querySelector('#notification-dropdown');
        const readAllBtn = container.querySelector('#notification-read-all');
        const switchBtn = container.querySelector('#notification-switch');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(dropdown);
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.closeDropdown(dropdown);
            }
        });

        if (readAllBtn) {
            readAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }

        if (switchBtn) {
            switchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNicknamePrompt(container);
            });
        }

        const items = container.querySelectorAll('.notification-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const id = Number(item.dataset.id);
                const postId = item.dataset.postId;
                this.handleNotificationClick(id, postId, dropdown);
            });
        });
    }

    bindNicknameEvents(container) {
        const toggleBtn = container.querySelector('#notification-toggle');
        const dropdown = container.querySelector('#notification-dropdown');
        const submitBtn = container.querySelector('#notification-nickname-submit');
        const input = container.querySelector('#notification-nickname-input');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(dropdown);
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.closeDropdown(dropdown);
            }
        });

        if (submitBtn && input) {
            submitBtn.addEventListener('click', () => {
                const name = input.value.trim();
                if (name) {
                    this.setNickname(name);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const name = input.value.trim();
                    if (name) {
                        this.setNickname(name);
                    }
                }
            });
        }
    }

    showNicknamePrompt(container) {
        this.nickname = '';
        this.renderDropdown(container);
    }

    toggleDropdown(dropdown) {
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'block';
            this.isDropdownOpen = true;
            if (this.nickname) {
                this.fetchNotifications();
            }
        } else {
            this.closeDropdown(dropdown);
        }
    }

    closeDropdown(dropdown) {
        dropdown.style.display = 'none';
        this.isDropdownOpen = false;
    }

    handleNotificationClick(notificationId, postId, dropdown) {
        this.markAsRead(notificationId);
        this.closeDropdown(dropdown);
        if (postId) {
            window.location.href = `/post.html?id=${postId}#comment-section`;
        }
    }
}

export const notificationManager = new NotificationManager();
