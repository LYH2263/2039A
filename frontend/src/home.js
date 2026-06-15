import { fetchApi, formatDate } from './config.js';
import { renderHeader } from './header.js';

renderHeader('home');

const app = document.getElementById('app');

async function loadPosts(page = 1) {
    try {
        const data = await fetchApi(`/posts.php?page=${page}`);
        renderPosts(data);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}

function renderPosts({ posts, pagination }) {
    let html = `
        <div class="row justify-content-center">
            <div class="col-md-10">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3>最新帖子</h3>
                    <a href="/create_post.html" class="btn btn-primary">我要发帖</a>
                </div>
    `;

    if (posts.length === 0) {
        html += `<div class="alert alert-info text-center">暂无帖子，快来发布第一条吧！</div>`;
    } else {
        html += `<div class="list-group">`;
        posts.forEach(post => {
            html += `
                <a href="/post.html?id=${post.id}" class="list-group-item list-group-item-action p-3">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1 text-primary">${escapeHtml(post.title)}</h5>
                        <small class="text-muted">${formatDate(post.created_at)}</small>
                    </div>
                    <p class="mb-1 text-truncate" style="max-width: 80%;">${escapeHtml(post.content.substring(0, 100))}...</p>
                    <small class="text-muted">
                        作者: ${escapeHtml(post.author_name)} | 
                        评论: <span class="badge bg-secondary rounded-pill">${post.comment_count}</span>
                    </small>
                </a>
            `;
        });
        html += `</div>`;
    }

    // Pagination
    if (pagination.total_pages > 1) {
        html += `<nav class="mt-4"><ul class="pagination justify-content-center">`;
        if (pagination.current_page > 1) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?page=${pagination.current_page - 1}'">上一页</button></li>`;
        }
        for (let i = 1; i <= pagination.total_pages; i++) {
            html += `<li class="page-item ${i === pagination.current_page ? 'active' : ''}">
                <button class="page-link" onclick="window.location.search='?page=${i}'">${i}</button>
            </li>`;
        }
        if (pagination.current_page < pagination.total_pages) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?page=${pagination.current_page + 1}'">下一页</button></li>`;
        }
        html += `</ul></nav>`;
    }

    html += `</div></div>`;
    app.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const urlParams = new URLSearchParams(window.location.search);
const page = parseInt(urlParams.get('page')) || 1;
loadPosts(page);
