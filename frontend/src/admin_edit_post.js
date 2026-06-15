import { fetchApi, escapeHtml, formatDate } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import { renderMarkdownSafe } from './markdown.js';
import './styles.css';

renderAdminHeader();

const app = document.getElementById('app');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');
let selectedTags = [];
let availableTags = [];
let revisions = [];
let currentPostSnapshot = null;
let selectedRevision = null;
let showDiffMode = false;

if (!postId) {
    app.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">无效的帖子ID</div></div>';
} else {
    loadPost(postId);
}

function computeLCS(arr1, arr2) {
    const m = arr1.length;
    const n = arr2.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp;
}

function diffLines(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const dp = computeLCS(oldLines, newLines);
    
    const result = [];
    let i = oldLines.length;
    let j = newLines.length;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.unshift({ type: 'equal', value: oldLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'added', value: newLines[j - 1] });
            j--;
        } else {
            result.unshift({ type: 'removed', value: oldLines[i - 1] });
            i--;
        }
    }
    
    return result;
}

function renderDiffView(oldText, newText) {
    const diffs = diffLines(oldText, newText);
    
    let addedCount = 0;
    let removedCount = 0;
    diffs.forEach(d => {
        if (d.type === 'added') addedCount++;
        if (d.type === 'removed') removedCount++;
    });
    
    const html = diffs.map(d => {
        const escaped = escapeHtml(d.value) || '&nbsp;';
        if (d.type === 'added') {
            return `<div class="diff-line diff-added"><span class="diff-sign">+</span>${escaped}</div>`;
        } else if (d.type === 'removed') {
            return `<div class="diff-line diff-removed"><span class="diff-sign">-</span>${escaped}</div>`;
        } else {
            return `<div class="diff-line diff-equal"><span class="diff-sign"> </span>${escaped}</div>`;
        }
    }).join('');
    
    return {
        html,
        stats: { added: addedCount, removed: removedCount }
    };
}

async function loadAvailableTags() {
    try {
        const data = await fetchApi('/tags.php?sort=post_count&order=desc&limit=50');
        availableTags = data.tags || [];
    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

async function loadRevisions() {
    try {
        const data = await fetchApi(`/admin/revisions.php?post_id=${postId}`);
        revisions = data.revisions || [];
        renderRevisionSidebar();
    } catch (error) {
        console.error('Failed to load revisions:', error);
        revisions = [];
        renderRevisionSidebar();
    }
}

async function loadPost(id) {
    try {
        const [postData] = await Promise.all([
            fetchApi(`/post.php?id=${id}`),
            loadAvailableTags()
        ]);
        selectedTags = (postData.tags || []).map(t => t.display_name);
        currentPostSnapshot = {
            title: postData.post.title,
            content: postData.post.content,
            tags: [...selectedTags]
        };
        renderEditForm(postData.post);
        loadRevisions();
    } catch (error) {
        app.innerHTML = `<div class="container mt-5"><div class="alert alert-danger">加载失败: ${error.message}</div></div>`;
    }
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
    
    if (exists) return;
    
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
    
    const input = document.getElementById('tags-input');
    if (input) input.value = '';
}

function renderPopularTags() {
    const container = document.getElementById('popular-tags');
    if (!container) return;
    
    const unusedTags = availableTags.filter(tag => 
        !selectedTags.some(t => t.toLowerCase() === tag.name)
    ).slice(0, 10);
    
    container.innerHTML = unusedTags.map(tag => `
        <button type="button" class="btn btn-sm btn-outline-primary tag-chip" data-tag="${escapeHtml(tag.display_name)}">
            ${escapeHtml(tag.display_name)} <span class="badge bg-light text-dark ms-1">${tag.post_count}</span>
        </button>
    `).join('');
    
    container.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            addTag(btn.dataset.tag);
            renderPopularTags();
        });
    });
}

let adminCurrentMdView = 'split';
let adminPreviewTimer = null;

function adminUpdateMdView(view) {
    adminCurrentMdView = view;
    const editPane = document.getElementById('md-edit-pane');
    const previewPane = document.getElementById('md-preview-pane');
    const divider = document.getElementById('md-divider');
    const previewHeader = previewPane?.querySelector('.md-preview-header');

    document.querySelectorAll('#md-view-toggle button').forEach(btn => {
        btn.classList.toggle('btn-primary', btn.dataset.view === view);
        btn.classList.toggle('btn-outline-primary', btn.dataset.view !== view);
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
            adminUpdatePreview();
            break;
        case 'split':
        default:
            divider.classList.remove('d-none');
            editPane.classList.add('active');
            previewPane.classList.add('active');
            if (previewHeader) previewHeader.classList.remove('d-none');
            if (container) container.classList.add('view-split');
            adminUpdatePreview();
            break;
    }
}

function adminUpdatePreview() {
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

function adminDebouncedUpdatePreview() {
    if (adminPreviewTimer) clearTimeout(adminPreviewTimer);
    adminPreviewTimer = setTimeout(adminUpdatePreview, 150);
}

function initAdminMdEditor() {
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
            adminUpdateMdView(btn.dataset.view);
        });
    });

    if (textarea) {
        textarea.addEventListener('input', adminDebouncedUpdatePreview);
        textarea.addEventListener('change', adminUpdatePreview);
    }

    adminUpdateMdView(adminCurrentMdView);
}

function renderRevisionSidebar() {
    const sidebar = document.getElementById('revision-sidebar');
    if (!sidebar) return;
    
    if (revisions.length === 0) {
        sidebar.innerHTML = `
            <div class="text-muted text-center py-4">
                <i class="bi bi-clock-history fs-2 d-block mb-2 opacity-50"></i>
                <small>暂无历史版本</small>
            </div>
        `;
        return;
    }
    
    sidebar.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0 fw-bold text-secondary">历史版本</h6>
            <span class="badge bg-light text-dark">${revisions.length}</span>
        </div>
        <div class="revision-list">
            ${revisions.map((rev, idx) => `
                <div class="revision-item ${selectedRevision?.id === rev.id ? 'active' : ''}" data-revision-id="${rev.id}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="revision-title text-truncate fw-medium">
                                ${idx === 0 ? '<span class="badge bg-info text-dark me-1">最新</span>' : ''}
                                ${escapeHtml(rev.title)}
                            </div>
                            <div class="revision-meta small text-muted mt-1">
                                <i class="bi bi-person"></i> ${escapeHtml(rev.created_by || 'admin')}
                            </div>
                            <div class="revision-meta small text-muted">
                                <i class="bi bi-calendar3"></i> ${formatDate(rev.created_at)}
                            </div>
                            ${rev.revision_note ? `<div class="revision-note small text-info mt-1"><i class="bi bi-info-circle"></i> ${escapeHtml(rev.revision_note)}</div>` : ''}
                        </div>
                    </div>
                    <div class="revision-actions mt-2 d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary view-revision" data-id="${rev.id}">
                            <i class="bi bi-eye"></i> 查看
                        </button>
                        <button class="btn btn-sm btn-outline-secondary diff-revision" data-id="${rev.id}">
                            <i class="bi bi-arrows-collapse"></i> 对比
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    sidebar.querySelectorAll('.view-revision').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewRevision(parseInt(btn.dataset.id));
        });
    });
    
    sidebar.querySelectorAll('.diff-revision').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDiffWithRevision(parseInt(btn.dataset.id));
        });
    });
}

async function viewRevision(revisionId) {
    try {
        const rev = await fetchApi(`/admin/revisions.php?id=${revisionId}`);
        selectedRevision = rev;
        showDiffMode = false;
        renderRevisionSidebar();
        renderRevisionModal(rev, false);
    } catch (error) {
        alert('加载版本失败: ' + error.message);
    }
}

async function showDiffWithRevision(revisionId) {
    try {
        const rev = await fetchApi(`/admin/revisions.php?id=${revisionId}`);
        selectedRevision = rev;
        showDiffMode = true;
        renderRevisionSidebar();
        renderRevisionModal(rev, true);
    } catch (error) {
        alert('加载版本失败: ' + error.message);
    }
}

function renderRevisionModal(rev, isDiff) {
    const modalId = 'revisionModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();
    
    const currentTitle = document.getElementById('title')?.value || currentPostSnapshot.title;
    const currentContent = document.getElementById('content')?.value || currentPostSnapshot.content;
    
    let titleContent = '';
    let bodyContent = '';
    let footerExtra = '';
    
    if (isDiff) {
        const titleDiff = renderDiffView(rev.title, currentTitle);
        const contentDiff = renderDiffView(rev.content, currentContent);
        const tagsDiff = renderDiffView(
            (rev.tags || []).join('\n'),
            selectedTags.join('\n')
        );
        
        const totalAdded = titleDiff.stats.added + contentDiff.stats.added + tagsDiff.stats.added;
        const totalRemoved = titleDiff.stats.removed + contentDiff.stats.removed + tagsDiff.stats.removed;
        
        titleContent = `
            <div class="d-flex align-items-center gap-3">
                <i class="bi bi-arrows-collapse text-primary"></i>
                <span>差异对比 #${rev.id} ↔ 当前版本</span>
                <span class="ms-auto">
                    <span class="badge bg-success me-1">+${totalAdded}</span>
                    <span class="badge bg-danger">-${totalRemoved}</span>
                </span>
            </div>
        `;
        
        bodyContent = `
            <div class="diff-summary mb-3 p-2 bg-light rounded small">
                <div class="row g-2">
                    <div class="col-auto"><span class="diff-legend diff-legend-added"></span> 新增</div>
                    <div class="col-auto"><span class="diff-legend diff-legend-removed"></span> 删除</div>
                    <div class="col-auto"><span class="diff-legend diff-legend-equal"></span> 未变</div>
                </div>
            </div>
            
            <div class="mb-4">
                <h6 class="text-muted mb-2"><i class="bi bi-type"></i> 标题</h6>
                <div class="diff-container rounded border">${titleDiff.html}</div>
            </div>
            
            <div class="mb-4">
                <h6 class="text-muted mb-2"><i class="bi bi-tags"></i> 标签</h6>
                <div class="diff-container rounded border">${tagsDiff.html || '<div class="diff-line diff-equal"><span class="diff-sign"> </span>(无)</div>'}</div>
            </div>
            
            <div>
                <h6 class="text-muted mb-2"><i class="bi bi-file-text"></i> 内容</h6>
                <div class="diff-container diff-content rounded border">${contentDiff.html}</div>
            </div>
        `;
    } else {
        titleContent = `
            <div class="d-flex align-items-center gap-3">
                <i class="bi bi-clock-history text-secondary"></i>
                <span>历史版本 #${rev.id}</span>
                <span class="ms-auto text-muted small">
                    ${formatDate(rev.created_at)} · ${escapeHtml(rev.created_by || 'admin')}
                </span>
            </div>
        `;
        
        const tagsHtml = (rev.tags || []).length > 0 
            ? (rev.tags || []).map(t => `<span class="badge bg-secondary me-1">${escapeHtml(t)}</span>`).join('')
            : '<span class="text-muted small">(无标签)</span>';
        
        bodyContent = `
            <div class="mb-4">
                <h6 class="text-muted mb-2"><i class="bi bi-type"></i> 标题</h6>
                <div class="p-3 bg-light rounded">${escapeHtml(rev.title)}</div>
            </div>
            
            <div class="mb-4">
                <h6 class="text-muted mb-2"><i class="bi bi-tags"></i> 标签</h6>
                <div class="p-3 bg-light rounded">${tagsHtml}</div>
            </div>
            
            <div>
                <h6 class="text-muted mb-2"><i class="bi bi-file-text"></i> 内容</h6>
                <div class="p-3 bg-light rounded revision-content-preview">
                    ${renderMarkdownSafe(rev.content)}
                </div>
            </div>
        `;
    }
    
    footerExtra = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">关闭</button>
        <button type="button" class="btn btn-primary rollback-btn" data-id="${rev.id}">
            <i class="bi bi-arrow-counterclockwise"></i> 回滚到此版本
        </button>
    `;
    
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header border-bottom-0 pb-0">
                        <h5 class="modal-title" id="${modalId}Label">${titleContent}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${bodyContent}
                    </div>
                    <div class="modal-footer border-top-0 pt-0">
                        ${footerExtra}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalEl = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    modalEl.querySelector('.rollback-btn').addEventListener('click', async () => {
        const confirmed = confirm(`确定要回滚到版本 #${rev.id} 吗？\n当前未保存的修改会丢失，且当前版本会被保存为新的历史记录。`);
        if (!confirmed) return;
        
        const btn = modalEl.querySelector('.rollback-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 回滚中...';
        
        try {
            const result = await fetchApi('/admin/revisions.php', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'rollback',
                    revision_id: rev.id
                })
            });
            
            modal.hide();
            
            document.getElementById('title').value = result.post.title;
            document.getElementById('content').value = result.post.content;
            selectedTags = result.post.tags || [];
            currentPostSnapshot = {
                title: result.post.title,
                content: result.post.content,
                tags: [...selectedTags]
            };
            renderSelectedTags();
            adminUpdatePreview();
            
            selectedRevision = null;
            showDiffMode = false;
            loadRevisions();
            
            showAlert('回滚成功！', 'success');
        } catch (error) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> 回滚到此版本';
            alert('回滚失败: ' + error.message);
        }
    });
}

function showAlert(message, type = 'danger') {
    const alertBox = document.getElementById('alert-box');
    if (!alertBox) return;
    
    const bsType = type === 'success' ? 'alert-success' : 
                   type === 'warning' ? 'alert-warning' : 
                   type === 'info' ? 'alert-info' : 'alert-danger';
    
    alertBox.innerHTML = `<div class="alert ${bsType} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
    
    setTimeout(() => {
        const alerts = alertBox.querySelectorAll('.alert');
        alerts.forEach(a => a.remove());
    }, 5000);
}

function renderEditForm(post) {
    app.innerHTML = `
    <div class="container-fluid mt-4 fade-in px-4">
        <div class="row g-4">
            <div class="col-lg-3 col-xl-2 order-lg-1 order-2">
                <div class="card shadow-sm border-0 sticky-top" style="top: 80px;">
                    <div class="card-header bg-white border-bottom py-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-clock-history text-primary"></i>
                            <h6 class="mb-0 fw-bold">版本历史</h6>
                        </div>
                    </div>
                    <div class="card-body p-0" id="revision-sidebar">
                        <div class="text-muted text-center py-4">
                            <div class="spinner-border spinner-border-sm text-muted mb-2" role="status"></div>
                            <div><small>加载中...</small></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-9 col-xl-10 order-lg-2 order-1">
                <div class="card shadow-lg border-0 rounded-lg">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-2 px-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <div class="rounded-circle bg-primary bg-opacity-10 p-2 me-3 text-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                      <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                                      <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                                    </svg>
                                </div>
                                <h4 class="mb-0 fw-bold text-gradient">编辑帖子</h4>
                            </div>
                            <div class="btn-group btn-group-sm" role="tablist" id="md-view-toggle">
                                <button type="button" class="btn btn-primary active" data-view="split" role="tab">
                                    <i class="bi bi-layout-split"></i> 双栏
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-view="edit" role="tab">
                                    <i class="bi bi-pencil-square"></i> 编辑
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-view="preview" role="tab">
                                    <i class="bi bi-eye"></i> 预览
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body px-4 pb-4">
                        <div id="alert-box"></div>
                        <form id="edit-form">
                            <div class="mb-4">
                                <label for="title" class="form-label text-secondary fw-medium">标题</label>
                                <input type="text" class="form-control form-control-lg bg-light border-0" id="title" value="${escapeHtml(post.title)}" required placeholder="请输入标题">
                            </div>
                            <div class="mb-4">
                                <label for="tags-input" class="form-label text-secondary fw-medium">标签（可选，最多10个）</label>
                                <div class="tag-input-wrapper position-relative">
                                    <div class="selected-tags d-flex flex-wrap gap-2 mb-2" id="selected-tags"></div>
                                    <input type="text" class="form-control bg-light border-0" id="tags-input" placeholder="输入标签后按回车或逗号添加">
                                </div>
                                <div class="mt-2">
                                    <small class="text-muted">已有标签：</small>
                                    <div class="popular-tags d-flex flex-wrap gap-2 mt-1" id="popular-tags"></div>
                                </div>
                            </div>
                            <div class="mb-4">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <label for="content" class="form-label text-secondary fw-medium mb-0">内容 <small class="text-muted ms-2">支持 Markdown 语法</small></label>
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
                                        <textarea class="form-control md-textarea bg-light border-0" id="content" rows="14" required placeholder="请输入内容">${escapeHtml(post.content)}</textarea>
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
                            <div class="d-flex justify-content-end gap-2 mt-4">
                                <a href="/admin/posts.html" class="btn btn-light text-muted px-4">取消</a>
                                <button type="submit" class="btn btn-primary px-4 shadow-sm d-flex align-items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2-circle me-2" viewBox="0 0 16 16">
                                      <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/>
                                      <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
                                    </svg>
                                    保存修改
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    document.getElementById('edit-form').addEventListener('submit', handleUpdate);
    
    document.getElementById('tags-input').addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value.endsWith(',') || value.endsWith('，')) {
            const tagName = value.slice(0, -1).trim();
            if (tagName) {
                addTag(tagName);
                renderPopularTags();
            }
            e.target.value = '';
        }
    });
    
    document.getElementById('tags-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.target.value.trim();
            if (value) {
                addTag(value);
                renderPopularTags();
            }
            e.target.value = '';
        }
        
        if (e.key === 'Backspace' && !e.target.value && selectedTags.length > 0) {
            selectedTags.pop();
            renderSelectedTags();
            renderPopularTags();
        }
    });
    
    renderSelectedTags();
    renderPopularTags();
    initAdminMdEditor();
}

async function handleUpdate(e) {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const alertBox = document.getElementById('alert-box');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>保存中...';
        
        await fetchApi('/admin/posts.php', {
            method: 'PUT',
            body: JSON.stringify({
                id: postId,
                title,
                content,
                tags: selectedTags
            })
        });
        
        currentPostSnapshot = {
            title,
            content,
            tags: [...selectedTags]
        };
        
        loadRevisions();
        showAlert('保存成功！历史版本已记录。', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2-circle me-2" viewBox="0 0 16 16">
              <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/>
              <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
            </svg>
            保存修改
        `;
    }
}
