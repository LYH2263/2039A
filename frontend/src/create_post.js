import { fetchApi, escapeHtml } from './config.js';
import { renderHeader } from './header.js';

renderHeader('create');

const app = document.getElementById('app');
let selectedTags = [];
let availableTags = [];

app.innerHTML = `
<div class="row justify-content-center">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h4 class="mb-0">发布新帖子</h4>
            </div>
            <div class="card-body">
                <div id="alert-box"></div>
                <form id="post-form">
                    <div class="mb-3">
                        <label for="title" class="form-label">标题 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="title" required>
                    </div>
                    
                    <div class="mb-3">
                        <label for="author" class="form-label">作者昵称 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="author" required>
                    </div>

                    <div class="mb-3">
                        <label for="tags-input" class="form-label">标签（可选，最多10个）</label>
                        <div class="tag-input-wrapper position-relative">
                            <div class="selected-tags d-flex flex-wrap gap-2 mb-2" id="selected-tags"></div>
                            <input type="text" class="form-control" id="tags-input" placeholder="输入标签后按回车或逗号添加，从下方选择已有标签">
                            <div class="tag-suggestions position-absolute w-100 bg-white border rounded shadow-sm d-none" id="tag-suggestions"></div>
                        </div>
                        <div class="mt-2">
                            <small class="text-muted">热门标签：</small>
                            <div class="popular-tags d-flex flex-wrap gap-2 mt-1" id="popular-tags"></div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="content" class="form-label">内容 <span class="text-danger">*</span></label>
                        <textarea class="form-control" id="content" rows="6" required></textarea>
                    </div>

                    <div class="d-grid gap-2">
                        <button type="submit" class="btn btn-success">立即发布</button>
                        <a href="/" class="btn btn-secondary">返回首页</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
`;

async function loadAvailableTags() {
    try {
        const data = await fetchApi('/tags.php?sort=post_count&order=desc&limit=20');
        availableTags = data.tags || [];
        renderPopularTags();
    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

function renderPopularTags() {
    const container = document.getElementById('popular-tags');
    if (!container) return;
    
    container.innerHTML = availableTags.slice(0, 10).map(tag => `
        <button type="button" class="btn btn-sm btn-outline-primary tag-chip" data-tag="${escapeHtml(tag.display_name)}">
            ${escapeHtml(tag.display_name)} <span class="badge bg-light text-dark ms-1">${tag.post_count}</span>
        </button>
    `).join('');
    
    container.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => addTag(btn.dataset.tag));
    });
}

function renderSelectedTags() {
    const container = document.getElementById('selected-tags');
    if (!container) return;
    
    container.innerHTML = selectedTags.map((tag, index) => `
        <span class="badge bg-primary d-flex align-items-center gap-1 px-2 py-1">
            ${escapeHtml(tag)}
            <button type="button" class="btn-close btn-close-white remove-tag" data-index="${index}" aria-label="Remove"></button>
        </span>
    `).join('');
    
    container.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            selectedTags.splice(index, 1);
            renderSelectedTags();
        });
    });
}

function addTag(tagName) {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    
    const normalized = trimmed.toLowerCase();
    const exists = selectedTags.some(t => t.toLowerCase() === normalized);
    
    if (exists) {
        showSuggestions([]);
        return;
    }
    
    if (selectedTags.length >= 10) {
        alert('最多只能添加10个标签');
        return;
    }
    
    if (trimmed.length > 50) {
        alert('标签名称不能超过50个字符');
        return;
    }
    
    selectedTags.push(trimmed);
    renderSelectedTags();
    showSuggestions([]);
    
    const input = document.getElementById('tags-input');
    if (input) input.value = '';
}

function showSuggestions(suggestions) {
    const container = document.getElementById('tag-suggestions');
    if (!container) return;
    
    if (suggestions.length === 0) {
        container.classList.add('d-none');
        return;
    }
    
    container.innerHTML = suggestions.map(tag => `
        <div class="p-2 hover-bg cursor-pointer tag-suggestion-item d-flex justify-content-between align-items-center" 
             data-tag="${escapeHtml(tag.display_name)}">
            <span>${escapeHtml(tag.display_name)}</span>
            <small class="text-muted">${tag.post_count} 篇</small>
        </div>
    `).join('');
    
    container.querySelectorAll('.tag-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            addTag(item.dataset.tag);
        });
    });
    
    container.classList.remove('d-none');
}

document.getElementById('tags-input').addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    if (!value) {
        showSuggestions([]);
        return;
    }
    
    if (value.endsWith(',') || value.endsWith('，')) {
        const tagName = value.slice(0, -1).trim();
        if (tagName) {
            addTag(tagName);
        }
        e.target.value = '';
        return;
    }
    
    const filtered = availableTags.filter(tag => 
        tag.display_name.toLowerCase().includes(value.toLowerCase()) &&
        !selectedTags.some(t => t.toLowerCase() === tag.name)
    ).slice(0, 8);
    
    showSuggestions(filtered);
});

document.getElementById('tags-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim();
        if (value) {
            addTag(value);
        }
        e.target.value = '';
    }
    
    if (e.key === 'Backspace' && !e.target.value && selectedTags.length > 0) {
        selectedTags.pop();
        renderSelectedTags();
    }
});

document.addEventListener('click', (e) => {
    const suggestions = document.getElementById('tag-suggestions');
    const tagsInput = document.getElementById('tags-input');
    if (suggestions && !suggestions.contains(e.target) && e.target !== tagsInput) {
        suggestions.classList.add('d-none');
    }
});

document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const author = document.getElementById('author').value.trim();
    const content = document.getElementById('content').value.trim();
    const alertBox = document.getElementById('alert-box');

    try {
        const data = await fetchApi('/posts.php', {
            method: 'POST',
            body: JSON.stringify({ 
                title, 
                author, 
                content,
                tags: selectedTags
            })
        });
        window.location.href = `/post.html?id=${data.id}`;
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});

loadAvailableTags();
renderSelectedTags();
