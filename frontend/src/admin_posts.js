import { fetchApi, formatDate } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader('posts');

const app = document.getElementById('app');

async function loadPosts() {
    try {
        // Reuse public endpoint for list, as it has all info needed
        const data = await fetchApi('/posts.php?page=1'); // TODO: Implement admin pagination if needed
        renderPosts(data.posts);
    } catch (error) {
        app.innerHTML = `<div class="container mt-4"><div class="alert alert-danger shadow-sm">${error.message}</div></div>`;
    }
}

function renderPosts(posts) {
    let html = `
    <div class="container fade-in py-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-dark mb-0">帖子管理</h3>
                <p class="text-muted small mb-0">管理所有发布的帖子</p>
            </div>
            <a href="/admin/index.html" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> 返回仪表盘
            </a>
        </div>
        
        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0 align-middle">
                        <thead class="bg-light">
                            <tr>
                                <th class="ps-4">ID</th>
                                <th>标题</th>
                                <th>作者</th>
                                <th>发布时间</th>
                                <th>评论数</th>
                                <th class="text-end pe-4">操作</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    if (posts.length === 0) {
        html += `<tr><td colspan="6" class="text-center py-4 text-muted">暂无帖子</td></tr>`;
    } else {
        posts.forEach(post => {
            html += `
                <tr>
                    <td class="ps-4 fw-bold text-muted">#${post.id}</td>
                    <td><a href="/post.html?id=${post.id}" target="_blank" class="text-decoration-none fw-medium text-dark">${escapeHtml(post.title)}</a></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2 bg-light text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-weight: bold; font-size: 14px;">
                                ${escapeHtml(post.author_name).charAt(0).toUpperCase()}
                            </div>
                            <span>${escapeHtml(post.author_name)}</span>
                        </div>
                    </td>
                    <td class="text-muted small">${formatDate(post.created_at)}</td>
                    <td><span class="badge bg-light text-dark border">${post.comment_count}</span></td>
                    <td class="text-end pe-4">
                        <a href="/admin/edit_post.html?id=${post.id}" class="btn btn-sm btn-outline-primary me-1">编辑</a>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${post.id}">删除</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table></div></div></div></div>`;
    app.innerHTML = html;

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('确定要删除这篇帖子及其所有评论吗？')) {
                const id = e.target.getAttribute('data-id');
                try {
                    await fetchApi(`/admin/posts.php?id=${id}`, { method: 'DELETE' });
                    loadPosts();
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadPosts();
