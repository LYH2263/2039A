import { fetchApi, formatDate, escapeHtml } from './config.js';
import { renderHeader } from './header.js';

renderHeader('home');

const app = document.getElementById('app');

function renderPostTags(tags) {
    if (!tags || tags.length === 0) return '';
    
    return `
        <div class="mt-2">
            ${tags.map(tag => `
                <a href="/?tag=${encodeURIComponent(tag.name)}" 
                   class="badge bg-light text-decoration-none text-primary border me-1"
                   onclick="event.stopPropagation();"
                   style="font-size: 0.75rem;">
                    <i class="bi bi-tag me-1"></i>${escapeHtml(tag.display_name)}
                </a>
            `).join('')}
        </div>
    `;
}

async function loadPosts(page = 1, tag = null) {
    try {
        let url = `/posts.php?page=${page}`;
        if (tag) {
            url += `&tag=${encodeURIComponent(tag)}`;
        }
        const data = await fetchApi(url);
        renderPosts(data);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}

function renderPosts({ posts, pagination, current_tag }) {
    let tagFilterHtml = '';
    if (current_tag) {
        tagFilterHtml = `
            <div class="alert alert-info d-flex justify-content-between align-items-center mb-4">
                <div>
                    <i class="bi bi-filter me-2"></i>
                    当前筛选标签：<strong class="badge bg-primary ms-2">${escapeHtml(current_tag.display_name)}</strong>
                    <span class="text-muted ms-2">(${current_tag.post_count} 篇帖子)</span>
                </div>
                <a href="/" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-x-lg me-1"></i>清除筛选
                </a>
            </div>
        `;
    }
    
    let pageTitle = current_tag ? 
        `标签：${escapeHtml(current_tag.display_name)}` : 
        '最新帖子';

    let html = `
        <div class="row justify-content-center">
            <div class="col-md-10">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3>${pageTitle}</h3>
                    <a href="/create_post.html" class="btn btn-primary">我要发帖</a>
                </div>
                ${tagFilterHtml}
    `;

    if (posts.length === 0) {
        if (current_tag) {
            html += `<div class="alert alert-info text-center">该标签下暂无帖子</div>`;
        } else {
            html += `<div class="alert alert-info text-center">暂无帖子，快来发布第一条吧！</div>`;
        }
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
                    ${renderPostTags(post.tags)}
                    <small class="text-muted">
                        作者: ${escapeHtml(post.author_name)} | 
                        评论: <span class="badge bg-secondary rounded-pill">${post.comment_count}</span>
                    </small>
                </a>
            `;
        });
        html += `</div>`;
    }

    if (pagination.total_pages > 1) {
        const tagParam = current_tag ? `&tag=${encodeURIComponent(current_tag.name)}` : '';
        
        html += `<nav class="mt-4"><ul class="pagination justify-content-center">`;
        if (pagination.current_page > 1) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?page=${pagination.current_page - 1}${tagParam}'">上一页</button></li>`;
        }
        for (let i = 1; i <= pagination.total_pages; i++) {
            html += `<li class="page-item ${i === pagination.current_page ? 'active' : ''}">
                <button class="page-link" onclick="window.location.search='?page=${i}${tagParam}'">${i}</button>
            </li>`;
        }
        if (pagination.current_page < pagination.total_pages) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?page=${pagination.current_page + 1}${tagParam}'">下一页</button></li>`;
        }
        html += `</ul></nav>`;
    }

    html += `</div></div>`;
    app.innerHTML = html;
}

const urlParams = new URLSearchParams(window.location.search);
const page = parseInt(urlParams.get('page')) || 1;
const tag = urlParams.get('tag');
loadPosts(page, tag);
