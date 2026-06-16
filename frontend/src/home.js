import './styles.css';
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

function highlightText(text, keywords) {
    if (!keywords || keywords.length === 0) return escapeHtml(text);
    
    const escaped = escapeHtml(text);
    
    const keywordPatterns = keywords.map(kw => {
        const escapedKw = escapeHtml(kw);
        return escapedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    
    const combinedPattern = keywordPatterns.join('|');
    const regex = new RegExp(`(${combinedPattern})`, 'gi');
    
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
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
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${escapeHtml(error.message)}</div>`;
    }
}

async function searchPosts(query, page = 1) {
    try {
        const url = `/search.php?q=${encodeURIComponent(query)}&page=${page}`;
        const data = await fetchApi(url);
        renderSearchResults(data);
    } catch (error) {
        if (error.message.includes('搜索关键词过长')) {
            app.innerHTML = `
                <div class="row justify-content-center">
                    <div class="col-md-10">
                        <div class="alert alert-warning text-center">
                            <i class="bi bi-exclamation-triangle me-2"></i>搜索关键词过长，请控制在 100 个字符以内
                        </div>
                        <div class="text-center mt-3">
                            <a href="/" class="btn btn-outline-primary"><i class="bi bi-arrow-left me-1"></i>返回首页</a>
                        </div>
                    </div>
                </div>`;
        } else {
            app.innerHTML = `<div class="alert alert-danger">搜索失败: ${escapeHtml(error.message)}</div>`;
        }
    }
}

function renderSearchResults({ posts, pagination, query, keywords }) {
    let html = `
        <div class="row justify-content-center">
            <div class="col-md-10">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3>
                        <i class="bi bi-search me-2"></i>搜索结果
                    </h3>
                    <a href="/" class="btn btn-outline-secondary btn-sm">
                        <i class="bi bi-x-lg me-1"></i>清除搜索
                    </a>
                </div>
                <div class="alert alert-info d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <i class="bi bi-info-circle me-2"></i>
                        搜索关键词：<strong>${keywords.map(k => `<span class="badge bg-primary me-1">${escapeHtml(k)}</span>`).join('')}</strong>
                        <span class="ms-2">共找到 <strong>${pagination.total_posts}</strong> 条结果</span>
                    </div>
                </div>
    `;

    if (posts.length === 0) {
        html += `
            <div class="text-center py-5">
                <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                <p class="text-muted mt-3">没有找到与「${escapeHtml(query)}」相关的帖子</p>
                <a href="/" class="btn btn-outline-primary mt-2"><i class="bi bi-arrow-left me-1"></i>返回首页</a>
            </div>`;
    } else {
        html += `<div class="list-group">`;
        posts.forEach(post => {
            const snippet = post.content.substring(0, 150);
            html += `
                <a href="/post.html?id=${post.id}" class="list-group-item list-group-item-action p-3">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1 text-primary">${highlightText(post.title, keywords)}</h5>
                        <small class="text-muted">${formatDate(post.created_at)}</small>
                    </div>
                    <p class="mb-1 text-truncate" style="max-width: 80%;">${highlightText(snippet, keywords)}${post.content.length > 150 ? '...' : ''}</p>
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
        html += `<nav class="mt-4"><ul class="pagination justify-content-center">`;
        if (pagination.current_page > 1) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?q=${encodeURIComponent(query)}&page=${pagination.current_page - 1}'">上一页</button></li>`;
        }
        for (let i = 1; i <= pagination.total_pages; i++) {
            html += `<li class="page-item ${i === pagination.current_page ? 'active' : ''}">
                <button class="page-link" onclick="window.location.search='?q=${encodeURIComponent(query)}&page=${i}'">${i}</button>
            </li>`;
        }
        if (pagination.current_page < pagination.total_pages) {
            html += `<li class="page-item"><button class="page-link" onclick="window.location.search='?q=${encodeURIComponent(query)}&page=${pagination.current_page + 1}'">下一页</button></li>`;
        }
        html += `</ul></nav>`;
    }

    html += `</div></div>`;
    app.innerHTML = html;
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
const searchQuery = urlParams.get('q');
const page = parseInt(urlParams.get('page')) || 1;
const tag = urlParams.get('tag');

if (searchQuery !== null && searchQuery.trim() !== '') {
    document.title = `搜索: ${searchQuery} - 极简论坛`;
    searchPosts(searchQuery.trim(), page);
} else {
    loadPosts(page, tag);
}
