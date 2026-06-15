import { fetchApi, formatDate } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader('comments');

const app = document.getElementById('app');

async function loadComments() {
    try {
        const data = await fetchApi('/admin/comments.php');
        renderComments(data.comments);
    } catch (error) {
        app.innerHTML = `<div class="container mt-4"><div class="alert alert-danger shadow-sm">${error.message}</div></div>`;
    }
}

function renderComments(comments) {
    let html = `
    <div class="container fade-in py-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-dark mb-0">评论管理</h3>
                <p class="text-muted small mb-0">管理所有用户评论</p>
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
                                <th>所属帖子</th>
                                <th>评论昵称</th>
                                <th>评论内容</th>
                                <th>时间</th>
                                <th class="text-end pe-4">操作</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    if (comments.length === 0) {
        html += `<tr><td colspan="6" class="text-center py-4 text-muted">暂无评论</td></tr>`;
    } else {
        comments.forEach(comment => {
            html += `
                <tr>
                    <td class="ps-4 fw-bold text-muted">#${comment.id}</td>
                    <td>
                        ${comment.post_title ? 
                            `<a href="/post.html?id=${comment.post_id}" target="_blank" class="text-decoration-none fw-medium text-dark">${escapeHtml(comment.post_title.substring(0, 20))}...</a>` : 
                            '<span class="badge bg-secondary">帖子已删除</span>'}
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2 bg-light text-success rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-weight: bold; font-size: 14px;">
                                ${escapeHtml(comment.author_name).charAt(0).toUpperCase()}
                            </div>
                            <span>${escapeHtml(comment.author_name)}</span>
                        </div>
                    </td>
                    <td class="text-muted small">${escapeHtml(comment.content.substring(0, 50))}...</td>
                    <td class="text-muted small">${formatDate(comment.created_at)}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${comment.id}">删除</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table></div></div></div></div>`;
    app.innerHTML = html;

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('确定要删除这条评论吗？')) {
                const id = e.target.getAttribute('data-id');
                try {
                    await fetchApi(`/admin/comments.php?id=${id}`, { method: 'DELETE' });
                    loadComments();
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

loadComments();
