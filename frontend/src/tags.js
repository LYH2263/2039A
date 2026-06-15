import { fetchApi, escapeHtml } from './config.js';
import { renderHeader } from './header.js';

renderHeader('tags');

const app = document.getElementById('app');
let sortBy = 'post_count';
let sortOrder = 'desc';

async function loadTags() {
    try {
        const data = await fetchApi(`/tags.php?sort=${sortBy}&order=${sortOrder}`);
        renderTagCloud(data.tags || []);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}

function calculateFontSize(postCount, maxCount, minCount) {
    const minSize = 0.875;
    const maxSize = 2.5;
    
    if (maxCount === minCount) {
        return (minSize + maxSize) / 2;
    }
    
    const ratio = (postCount - minCount) / (maxCount - minCount);
    return minSize + ratio * (maxSize - minSize);
}

function getTagColor(index, total) {
    const colors = [
        'text-primary',
        'text-success',
        'text-danger',
        'text-warning',
        'text-info',
        'text-dark',
        'text-secondary',
        'text-primary-emphasis',
        'text-success-emphasis',
        'text-info-emphasis'
    ];
    return colors[index % colors.length];
}

function renderTagCloud(tags) {
    if (tags.length === 0) {
        app.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-10">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h3><i class="bi bi-tags me-2"></i>标签云</h3>
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-primary ${sortBy === 'post_count' ? 'active' : ''}" id="sort-count">
                                <i class="bi bi-sort-numeric-down me-1"></i>按数量
                            </button>
                            <button class="btn btn-outline-primary ${sortBy === 'name' ? 'active' : ''}" id="sort-name">
                                <i class="bi bi-sort-alpha-down me-1"></i>按名称
                            </button>
                            <button class="btn btn-outline-secondary" id="toggle-order">
                                <i class="bi bi-arrow-${sortOrder === 'desc' ? 'down' : 'up'}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-body text-center py-5">
                            <i class="bi bi-tags display-1 text-muted"></i>
                            <p class="text-muted mt-3">暂无标签，快来发帖添加第一个标签吧！</p>
                            <a href="/create_post.html" class="btn btn-primary mt-2">
                                <i class="bi bi-plus-circle me-1"></i>发布新帖
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        bindSortEvents();
        return;
    }

    const postCounts = tags.map(t => t.post_count);
    const maxCount = Math.max(...postCounts);
    const minCount = Math.min(...postCounts);
    const totalPosts = postCounts.reduce((a, b) => a + b, 0);
    
    let html = `
        <div class="row justify-content-center">
            <div class="col-md-10">
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h3><i class="bi bi-tags me-2"></i>标签云</h3>
                        <small class="text-muted">共 ${tags.length} 个标签，${totalPosts} 篇帖子</small>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-primary ${sortBy === 'post_count' ? 'active' : ''}" id="sort-count">
                            <i class="bi bi-sort-numeric-down me-1"></i>按数量
                        </button>
                        <button class="btn btn-outline-primary ${sortBy === 'name' ? 'active' : ''}" id="sort-name">
                            <i class="bi bi-sort-alpha-down me-1"></i>按名称
                        </button>
                        <button class="btn btn-outline-secondary" id="toggle-order" title="${sortOrder === 'desc' ? '降序' : '升序'}">
                            <i class="bi bi-arrow-${sortOrder === 'desc' ? 'down' : 'up'}"></i>
                        </button>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-body tag-cloud-container text-center py-5">
    `;
    
    tags.forEach((tag, index) => {
        const fontSize = calculateFontSize(tag.post_count, maxCount, minCount);
        const colorClass = getTagColor(index, tags.length);
        const opacity = 0.6 + (tag.post_count / maxCount) * 0.4;
        
        html += `
            <a href="/?tag=${encodeURIComponent(tag.name)}" 
               class="tag-cloud-item text-decoration-none ${colorClass} mx-2 my-1 d-inline-block"
               style="font-size: ${fontSize}rem; opacity: ${opacity};"
               title="${escapeHtml(tag.display_name)} - ${tag.post_count} 篇帖子">
                ${escapeHtml(tag.display_name)}
                <sup class="small ms-1 opacity-75">${tag.post_count}</sup>
            </a>
        `;
    });
    
    html += `
                    </div>
                </div>
                
                <div class="card mt-4">
                    <div class="card-header bg-light">
                        <h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>标签列表</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead class="bg-light">
                                    <tr>
                                        <th class="ps-3">标签</th>
                                        <th>帖子数量</th>
                                        <th>创建时间</th>
                                        <th class="text-end pe-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
    `;
    
    tags.forEach(tag => {
        html += `
            <tr>
                <td class="ps-3">
                    <a href="/?tag=${encodeURIComponent(tag.name)}" class="text-decoration-none">
                        <i class="bi bi-tag me-1 text-primary"></i>
                        <strong>${escapeHtml(tag.display_name)}</strong>
                    </a>
                </td>
                <td>
                    <span class="badge bg-primary rounded-pill">${tag.post_count}</span>
                </td>
                <td class="text-muted small">${formatDate(tag.created_at)}</td>
                <td class="text-end pe-3">
                    <a href="/?tag=${encodeURIComponent(tag.name)}" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-search me-1"></i>查看帖子
                    </a>
                </td>
            </tr>
        `;
    });
    
    html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    app.innerHTML = html;
    bindSortEvents();
}

function bindSortEvents() {
    const sortCountBtn = document.getElementById('sort-count');
    const sortNameBtn = document.getElementById('sort-name');
    const toggleOrderBtn = document.getElementById('toggle-order');
    
    if (sortCountBtn) {
        sortCountBtn.addEventListener('click', () => {
            sortBy = 'post_count';
            loadTags();
        });
    }
    
    if (sortNameBtn) {
        sortNameBtn.addEventListener('click', () => {
            sortBy = 'name';
            loadTags();
        });
    }
    
    if (toggleOrderBtn) {
        toggleOrderBtn.addEventListener('click', () => {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            loadTags();
        });
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('zh-CN');
}

loadTags();
