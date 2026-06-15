import { fetchApi, escapeHtml } from './config.js';
import { renderHeader } from './header.js';
import { renderMarkdownSafe } from './markdown.js';
import { notificationManager } from './notifications.js';

renderHeader('create');

const app = document.getElementById('app');
let selectedTags = [];
let availableTags = [];

app.innerHTML = `
<div class="row justify-content-center">
    <div class="col-lg-10 col-md-12">
        <div class="card">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h4 class="mb-0">发布新帖子</h4>
                <div class="btn-group btn-group-sm" role="tablist" id="md-view-toggle">
                    <button type="button" class="btn btn-light active" data-view="split" role="tab">
                        <i class="bi bi-layout-split"></i> 双栏
                    </button>
                    <button type="button" class="btn btn-outline-light" data-view="edit" role="tab">
                        <i class="bi bi-pencil-square"></i> 编辑
                    </button>
                    <button type="button" class="btn btn-outline-light" data-view="preview" role="tab">
                        <i class="bi bi-eye"></i> 预览
                    </button>
                </div>
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
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label for="content" class="form-label mb-0">内容 <span class="text-danger">*</span> <small class="text-muted ms-2">支持 Markdown 语法</small></label>
                            <small class="text-muted">
                                <a href="javascript:void(0)" id="md-help-toggle" class="text-decoration-none">
                                    <i class="bi bi-question-circle"></i> Markdown 语法帮助
                                </a>
                            </small>
                        </div>
                        
                        <div class="alert alert-info py-2 px-3 mb-2 d-none" id="md-help-box">
                            <small><strong>快速语法：</strong></small>
                            <div class="row mt-1 g-2">
                                <div class="col-md-4"><small><code># 标题</code> / <code>**粗体**</code> / <code>*斜体*</code></small></div>
                                <div class="col-md-4"><small><code>- 列表项</code> / <code>1. 有序</code> / <code>[链接](url)</code></small></div>
                                <div class="col-md-4"><small><code>\`代码\`</code> / <code>\`\`\`代码块\`\`\`</code> / <code>> 引用</code></small></div>
                            </div>
                        </div>

                        <div class="md-editor-container" id="md-editor-container">
                            <div class="md-editor-pane md-editor-edit active" id="md-edit-pane">
                                <textarea class="form-control md-textarea" id="content" rows="14" required placeholder="支持 Markdown 语法..."></textarea>
                            </div>
                            <div class="md-divider d-none" id="md-divider"></div>
                            <div class="md-editor-pane md-editor-preview d-none" id="md-preview-pane">
                                <div class="md-preview-header d-none">
                                    <i class="bi bi-eye"></i> 实时预览
                                </div>
                                <div class="md-preview-content markdown-body" id="md-preview-content">
                                    <p class="text-muted fst-italic">在左侧输入 Markdown，这里会实时预览...</p>
                                </div>
                            </div>
                        </div>
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

        if (author && notificationManager.nickname !== author) {
            notificationManager.setNickname(author);
        }

        window.location.href = `/post.html?id=${data.id}`;
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});

let currentMdView = 'split';
let previewUpdateTimer = null;

function updateMdView(view) {
    currentMdView = view;
    const editPane = document.getElementById('md-edit-pane');
    const previewPane = document.getElementById('md-preview-pane');
    const divider = document.getElementById('md-divider');
    const previewHeader = previewPane?.querySelector('.md-preview-header');

    document.querySelectorAll('#md-view-toggle button').forEach(btn => {
        btn.classList.toggle('btn-light', btn.dataset.view === view);
        btn.classList.toggle('btn-outline-light', btn.dataset.view !== view);
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (!editPane || !previewPane || !divider) return;

    editPane.classList.remove('active', 'd-none');
    previewPane.classList.remove('active', 'd-none');
    divider.classList.add('d-none');
    if (previewHeader) previewHeader.classList.add('d-none');

    const container = document.getElementById('md-editor-container');
    if (container) {
        container.classList.remove('view-split', 'view-edit-only', 'view-preview-only');
    }

    switch (view) {
        case 'edit':
            previewPane.classList.add('d-none');
            editPane.classList.add('active');
            if (container) container.classList.add('view-edit-only');
            break;
        case 'preview':
            editPane.classList.add('d-none');
            previewPane.classList.add('active');
            if (previewHeader) previewHeader.classList.remove('d-none');
            if (container) container.classList.add('view-preview-only');
            updatePreview();
            break;
        case 'split':
        default:
            divider.classList.remove('d-none');
            editPane.classList.add('active');
            previewPane.classList.add('active');
            if (previewHeader) previewHeader.classList.remove('d-none');
            if (container) container.classList.add('view-split');
            updatePreview();
            break;
    }
}

function updatePreview() {
    const textarea = document.getElementById('content');
    const previewContent = document.getElementById('md-preview-content');
    if (!textarea || !previewContent) return;

    const markdown = textarea.value;
    
    if (!markdown.trim()) {
        previewContent.innerHTML = '<p class="text-muted fst-italic">在左侧输入 Markdown，这里会实时预览...</p>';
        return;
    }

    try {
        previewContent.innerHTML = renderMarkdownSafe(markdown);
    } catch (err) {
        console.warn('Preview render error:', err);
        previewContent.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(markdown)}</pre>`;
    }
}

function debouncedUpdatePreview() {
    if (previewUpdateTimer) clearTimeout(previewUpdateTimer);
    previewUpdateTimer = setTimeout(updatePreview, 150);
}

function initMdEditor() {
    const textarea = document.getElementById('content');
    const helpToggle = document.getElementById('md-help-toggle');
    const helpBox = document.getElementById('md-help-box');

    if (helpToggle && helpBox) {
        helpToggle.addEventListener('click', (e) => {
            e.preventDefault();
            helpBox.classList.toggle('d-none');
        });
    }

    document.querySelectorAll('#md-view-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            updateMdView(btn.dataset.view);
        });
    });

    if (textarea) {
        textarea.addEventListener('input', debouncedUpdatePreview);
        textarea.addEventListener('change', updatePreview);
    }

    updateMdView(currentMdView);
}

loadAvailableTags();
renderSelectedTags();
initMdEditor();

if (notificationManager.nickname) {
    const authorInput = document.getElementById('author');
    if (authorInput && !authorInput.value) {
        authorInput.value = notificationManager.nickname;
    }
}
