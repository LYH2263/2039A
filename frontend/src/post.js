import { fetchApi, formatDate, escapeHtml } from './config.js';
import { renderHeader } from './header.js';
import { DanmakuEngine } from './danmaku.js';
import { CommentMindMap } from './mindmap.js';

renderHeader();

const app = document.getElementById('app');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

let currentAnnotations = [];
let activeAnnotationIds = [];

let danmakuEngine = null;
let danmakuPollTimer = null;
let danmakuMaxId = 0;
let isDanmakuMode = false;
let currentPostData = null;
let allComments = [];
let commentTreeData = null;
let currentViewMode = 'list';
let mindMapInstance = null;
let replyToCommentId = null;
let authorMap = new Map();

if (!postId) {
    app.innerHTML = '<div class="alert alert-danger">无效的帖子ID</div>';
} else {
    loadPost(postId);
}

async function loadPost(id) {
    try {
        const [postData, annotationData, treeData] = await Promise.all([
            fetchApi(`/post.php?id=${id}`),
            fetchApi(`/annotations.php?post_id=${id}`),
            fetchApi(`/comments.php?post_id=${id}&view=tree`)
        ]);
        currentAnnotations = annotationData.annotations || [];
        currentPostData = postData;
        allComments = postData.comments || [];
        commentTreeData = treeData;
        danmakuMaxId = allComments.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0);
        
        authorMap.clear();
        allComments.forEach(c => {
            authorMap.set(Number(c.id), c.author_name);
        });
        
        renderPost(postData);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}



function buildHighlightedHtml(rawContent, annotations) {
    const validated = validateAnnotations(rawContent, annotations);
    if (validated.length === 0) {
        return escapeHtml(rawContent);
    }

    const segments = buildSegments(rawContent.length, validated);
    let html = '';
    for (const seg of segments) {
        const text = rawContent.substring(seg.start, seg.end);
        const escaped = escapeHtml(text);
        if (seg.annotationIds.length === 0) {
            html += escaped;
        } else {
            const idsStr = seg.annotationIds.join(',');
            const hasAnnotation = seg.annotationIds.some(id => {
                const a = validated.find(a => a.id == id);
                return a && a.type === 'annotation';
            });
            const cls = hasAnnotation ? 'ann-mark ann-mark-annotated' : 'ann-mark';
            html += `<mark class="${cls}" data-ann-ids="${idsStr}">${escaped}</mark>`;
        }
    }
    return html;
}

function validateAnnotations(rawContent, annotations) {
    return annotations.filter(ann => {
        if (ann.start_offset < 0 || ann.end_offset > rawContent.length || ann.start_offset >= ann.end_offset) {
            return false;
        }
        const actual = rawContent.substring(ann.start_offset, ann.end_offset);
        if (actual === ann.selected_text) {
            return true;
        }
        const searchFrom = Math.max(0, ann.start_offset - 20);
        const searchTo = Math.min(rawContent.length, ann.end_offset + 20);
        const region = rawContent.substring(searchFrom, searchTo);
        const idx = region.indexOf(ann.selected_text);
        if (idx !== -1) {
            ann.start_offset = searchFrom + idx;
            ann.end_offset = ann.start_offset + ann.selected_text.length;
            return true;
        }
        return false;
    });
}

function buildSegments(contentLen, annotations) {
    const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset || a.end_offset - b.end_offset);
    const points = new Set([0, contentLen]);
    for (const a of sorted) {
        points.add(a.start_offset);
        points.add(a.end_offset);
    }
    const offsets = [...points].sort((a, b) => a - b);

    const segments = [];
    for (let i = 0; i < offsets.length - 1; i++) {
        const start = offsets[i];
        const end = offsets[i + 1];
        const coveringIds = sorted
            .filter(a => a.start_offset <= start && a.end_offset >= end)
            .map(a => a.id);
        segments.push({ start, end, annotationIds: coveringIds });
    }
    return segments;
}

function getTextOffset(container, node, offset) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    while (walker.nextNode()) {
        if (walker.currentNode === node) {
            return charCount + offset;
        }
        charCount += walker.currentNode.textContent.length;
    }
    return -1;
}

function buildCommentTree(comments) {
    const map = new Map();
    const roots = [];
    
    comments.forEach(c => {
        map.set(Number(c.id), { ...c, children: [] });
    });
    
    comments.forEach(c => {
        const node = map.get(Number(c.id));
        if (c.parent_id && map.has(Number(c.parent_id))) {
            map.get(Number(c.parent_id)).children.push(node);
        } else {
            roots.push(node);
        }
    });
    
    return roots;
}

function renderCommentListWithHierarchy(comments) {
    if (comments.length === 0) {
        return `<p class="text-muted mb-4">暂无评论，抢沙发！</p>`;
    }
    
    const tree = buildCommentTree(comments);
    
    const renderNode = (node, depth = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isReply = node.parent_id !== null && node.parent_id !== undefined;
        
        let html = `
            <div class="comment-item ${hasChildren ? 'with-replies' : ''}" data-comment-id="${node.id}">
                <div class="card mb-3 ${isReply ? 'reply-item' : 'bg-light'}">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <strong>${escapeHtml(node.author_name)}</strong>
                                    ${isReply && authorMap.has(Number(node.parent_id)) ? 
                                        `<span class="reply-to-badge">回复 @${escapeHtml(authorMap.get(Number(node.parent_id)))}</span>` : ''}
                                </div>
                                <p class="mb-0 mt-1">${escapeHtml(node.content)}</p>
                                <div class="d-flex gap-3 mt-2">
                                    <small class="text-muted">${formatDate(node.created_at)}</small>
                                    <button class="btn btn-sm btn-link p-0 reply-btn" data-comment-id="${node.id}">
                                        <i class="bi bi-reply"></i> 回复
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        if (hasChildren) {
            html += `<div class="reply-container">`;
            node.children.forEach(child => {
                html += renderNode(child, depth + 1);
            });
            html += `</div>`;
        }
        
        return html;
    };
    
    return tree.map(node => renderNode(node)).join('');
}

function renderEmptyMindmap() {
    return `
        <div class="mindmap-wrapper">
            <div class="empty-mindmap">
                <div class="empty-mindmap-icon">
                    <i class="bi bi-diagram-3"></i>
                </div>
                <div class="empty-mindmap-text">暂无评论，成为第一个评论者吧！</div>
            </div>
        </div>
    `;
}

function switchViewMode(mode) {
    if (mode === currentViewMode) return;
    
    currentViewMode = mode;
    
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    
    const listView = document.getElementById('comments-list-view');
    const mindmapView = document.getElementById('comments-mindmap-view');
    
    if (mode === 'list') {
        listView.classList.remove('d-none');
        mindmapView.classList.add('d-none');
        if (mindMapInstance) {
            mindMapInstance.destroy();
            mindMapInstance = null;
        }
    } else {
        listView.classList.add('d-none');
        mindmapView.classList.remove('d-none');
        initMindMap();
    }
}

function initMindMap() {
    const container = document.getElementById('mindmap-container');
    if (!container || !commentTreeData || !commentTreeData.tree) return;
    
    if (mindMapInstance) {
        mindMapInstance.destroy();
    }
    
    mindMapInstance = new CommentMindMap(container, {
        onNodeClick: (node) => {
            if (node.type === 'root') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (node.type !== 'aggregation') {
                switchViewMode('list');
                setTimeout(() => scrollToComment(node.id), 100);
            }
        },
        onNodeDoubleClick: (node) => {
        }
    });
    
    mindMapInstance.setData(commentTreeData.tree, currentPostData.post);
}

function scrollToComment(commentId) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentEl) {
        commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentEl.style.transition = 'box-shadow 0.3s ease';
        commentEl.querySelector('.card').style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.3)';
        setTimeout(() => {
            if (commentEl.querySelector('.card')) {
                commentEl.querySelector('.card').style.boxShadow = '';
            }
        }, 2000);
    }
}

function renderPost({ post, comments }) {
    document.title = `${post.title} - 极简论坛`;

    const contentHtml = buildHighlightedHtml(post.content, currentAnnotations);

    let html = `
        <div class="row justify-content-center">
            <div class="col-lg-8 col-md-10">
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb">
                        <li class="breadcrumb-item"><a href="/">首页</a></li>
                        <li class="breadcrumb-item active" aria-current="page">帖子详情</li>
                    </ol>
                </nav>

                <div class="card mb-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <h1 class="card-title mb-0">${escapeHtml(post.title)}</h1>
                            <div class="d-flex gap-2 align-items-center">
                                <label class="danmaku-switch form-check form-switch mb-0" title="开启弹幕模式">
                                    <input class="form-check-input" type="checkbox" id="danmaku-toggle" role="switch">
                                    <span class="form-check-label danmaku-switch-label" for="danmaku-toggle">
                                        <i class="bi bi-chat-dots"></i> 弹幕
                                    </span>
                                </label>
                            </div>
                        </div>
                        <h6 class="card-subtitle mb-4 text-muted">
                            作者: ${escapeHtml(post.author_name)} |
                            发布于: ${formatDate(post.created_at)}
                        </h6>
                        <div class="card-text ann-content" id="post-content-wrapper" style="white-space: pre-wrap; position: relative;">${contentHtml}</div>
                    </div>
                </div>

                <div id="comments-section">
                    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <h4 class="mb-0">评论区 (${comments.length})</h4>
                        <div class="view-toggle-group" role="tablist">
                            <button class="view-toggle-btn ${currentViewMode === 'list' ? 'active' : ''}" data-view="list" role="tab">
                                <i class="bi bi-list"></i> <span>列表</span>
                            </button>
                            <button class="view-toggle-btn ${currentViewMode === 'mindmap' ? 'active' : ''}" data-view="mindmap" role="tab">
                                <i class="bi bi-diagram-3"></i> <span>思维导图</span>
                            </button>
                        </div>
                    </div>
                    
                    <div id="comments-list-view" class="${currentViewMode === 'list' ? '' : 'd-none'}">
                        ${renderCommentListWithHierarchy(comments)}
                    </div>
                    
                    <div id="comments-mindmap-view" class="${currentViewMode === 'mindmap' ? '' : 'd-none'}">
                        ${commentTreeData && commentTreeData.tree && commentTreeData.tree.length > 0 ? 
                            '<div id="mindmap-container"></div>' : 
                            renderEmptyMindmap()}
                    </div>
                </div>

                <div class="card mt-4">
                    <div class="card-header">
                        ${replyToCommentId ? 
                            `<div class="d-flex justify-content-between align-items-center">
                                <span>回复 <strong>@${escapeHtml(authorMap.get(replyToCommentId) || '评论')}</strong></span>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="cancel-reply-btn">
                                    <i class="bi bi-x"></i> 取消
                                </button>
                            </div>` : 
                            '发表评论'}
                    </div>
                    <div class="card-body">
                        <div id="alert-box"></div>
                        <form id="comment-form">
                            <div class="mb-3">
                                <label for="nickname" class="form-label">昵称 <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="nickname" required>
                            </div>
                            <div class="mb-3">
                                <label for="content" class="form-label">评论内容 <span class="text-danger">*</span></label>
                                <textarea class="form-control" id="content" rows="3" required placeholder="${replyToCommentId ? '写下你的回复...' : '写下你的评论...'}"></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">${replyToCommentId ? '提交回复' : '提交评论'}</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <div id="danmaku-controls" class="danmaku-controls" style="display: none;">
            <div class="danmaku-controls-inner">
                <button type="button" class="btn btn-sm btn-outline-secondary danmaku-ctrl-btn" id="danmaku-pause-btn" title="暂停/继续">
                    <i class="bi bi-pause-fill"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger danmaku-ctrl-btn" id="danmaku-close-btn" title="关闭弹幕">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="danmaku-slider-group">
                    <label class="danmaku-slider-label"><i class="bi bi-speedometer2"></i></label>
                    <input type="range" id="danmaku-speed" min="0.2" max="3" step="0.1" value="1" class="danmaku-slider" title="速度">
                    <span class="danmaku-slider-value" id="danmaku-speed-val">1.0x</span>
                </div>
                <div class="danmaku-slider-group">
                    <label class="danmaku-slider-label"><i class="bi bi-cloud-sun"></i></label>
                    <input type="range" id="danmaku-opacity" min="0.1" max="1" step="0.05" value="0.9" class="danmaku-slider" title="透明度">
                    <span class="danmaku-slider-value" id="danmaku-opacity-val">90%</span>
                </div>
            </div>
        </div>
    `;

    app.innerHTML = html;

    initAnnotationUI(post);
    document.getElementById('comment-form').addEventListener('submit', handleCommentSubmit);
    initDanmakuUI();
    
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchViewMode(btn.dataset.view);
        });
    });
    
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const commentId = Number(btn.dataset.commentId);
            startReply(commentId);
        });
    });
    
    const cancelReplyBtn = document.getElementById('cancel-reply-btn');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }
    
    if (currentViewMode === 'mindmap' && commentTreeData && commentTreeData.tree && commentTreeData.tree.length > 0) {
        setTimeout(() => initMindMap(), 50);
    }
}

function startReply(commentId) {
    replyToCommentId = commentId;
    renderPost(currentPostData);
    
    const contentTextarea = document.getElementById('content');
    if (contentTextarea) {
        contentTextarea.focus();
    }
}

function cancelReply() {
    replyToCommentId = null;
    renderPost(currentPostData);
}

function refreshComments() {
    return Promise.all([
        fetchApi(`/post.php?id=${postId}`),
        fetchApi(`/comments.php?post_id=${postId}&view=tree`)
    ]).then(([postData, treeData]) => {
        currentPostData = postData;
        allComments = postData.comments || [];
        commentTreeData = treeData;
        
        authorMap.clear();
        allComments.forEach(c => {
            authorMap.set(Number(c.id), c.author_name);
        });
        
        renderPost(currentPostData);
    });
}

function initAnnotationUI(post) {
    const contentEl = document.querySelector('.ann-content');
    if (!contentEl) return;

    renderBadges(contentEl);

    const bubble = document.createElement('div');
    bubble.className = 'ann-bubble';
    bubble.id = 'ann-bubble';
    bubble.innerHTML = `
        <button class="ann-bubble-btn ann-btn-highlight" title="高亮">
            <i class="bi bi-highlighter"></i> 高亮
        </button>
        <button class="ann-bubble-btn ann-btn-annotate" title="批注">
            <i class="bi bi-chat-left-text"></i> 批注
        </button>
    `;
    document.body.appendChild(bubble);

    const sidebar = document.createElement('div');
    sidebar.className = 'ann-sidebar';
    sidebar.id = 'ann-sidebar';
    sidebar.innerHTML = `<div class="ann-sidebar-header">批注详情</div><div class="ann-sidebar-body" id="ann-sidebar-body"></div>`;
    document.body.appendChild(sidebar);

    let selectionTimeout = null;

    contentEl.addEventListener('mouseup', (e) => {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(() => {
            handleSelection(e, contentEl, bubble, post);
        }, 10);
    });

    document.addEventListener('mousedown', (e) => {
        if (!bubble.contains(e.target) && !e.target.closest('.ann-bubble-btn')) {
            bubble.classList.remove('ann-bubble-visible');
        }
        if (!sidebar.contains(e.target) && !e.target.closest('.ann-mark')) {
            sidebar.classList.remove('ann-sidebar-visible');
        }
    });

    let sidebarDebounce = null;

    contentEl.addEventListener('click', (e) => {
        const mark = e.target.closest('.ann-mark');
        if (!mark) return;
        const ids = mark.dataset.annIds.split(',').map(Number);
        showAnnotationSidebar(ids, e);
    });

    contentEl.addEventListener('mouseover', (e) => {
        const mark = e.target.closest('.ann-mark');
        if (!mark) return;
        clearTimeout(sidebarDebounce);
        sidebarDebounce = setTimeout(() => {
            const ids = mark.dataset.annIds.split(',').map(Number);
            showAnnotationSidebar(ids, e);
        }, 80);
    });

    bubble.querySelector('.ann-btn-highlight').addEventListener('click', () => {
        const range = getLastSelectionRange(contentEl);
        if (!range) return;
        createAnnotation(post.id, range, 'highlight', null);
        bubble.classList.remove('ann-bubble-visible');
    });

    bubble.querySelector('.ann-btn-annotate').addEventListener('click', () => {
        const range = getLastSelectionRange(contentEl);
        if (!range) return;
        showAnnotationModal(post.id, range);
        bubble.classList.remove('ann-bubble-visible');
    });
}

function handleSelection(e, contentEl, bubble, post) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim() === '') {
        bubble.classList.remove('ann-bubble-visible');
        return;
    }

    if (!contentEl.contains(sel.anchorNode) || !contentEl.contains(sel.focusNode)) {
        bubble.classList.remove('ann-bubble-visible');
        return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    bubble.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
    bubble.style.top = `${rect.top + window.scrollY - 48}px`;
    bubble.classList.add('ann-bubble-visible');
}

function getLastSelectionRange(contentEl) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    if (!contentEl.contains(sel.anchorNode) || !contentEl.contains(sel.focusNode)) return null;

    const start = getTextOffset(contentEl, sel.anchorNode, sel.anchorOffset);
    const end = getTextOffset(contentEl, sel.focusNode, sel.focusOffset);

    if (start === -1 || end === -1) return null;

    return {
        startOffset: Math.min(start, end),
        endOffset: Math.max(start, end),
        selectedText: sel.toString()
    };
}

async function createAnnotation(postId, range, type, annotationText) {
    try {
        const nickname = prompt('请输入你的昵称:');
        if (!nickname || !nickname.trim()) return;

        const data = await fetchApi('/annotations.php', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId,
                start_offset: range.startOffset,
                end_offset: range.endOffset,
                selected_text: range.selectedText,
                annotation_text: annotationText,
                author_name: nickname.trim(),
                type: type
            })
        });
        currentAnnotations.push(data.annotation);
        refreshHighlights();
    } catch (error) {
        alert(`创建失败: ${error.message}`);
    }
}

function showAnnotationModal(postId, range) {
    const existing = document.getElementById('ann-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ann-modal';
    modal.className = 'ann-modal-overlay';
    modal.innerHTML = `
        <div class="ann-modal">
            <div class="ann-modal-header">
                <span>添加批注</span>
                <button class="ann-modal-close">&times;</button>
            </div>
            <div class="ann-modal-body">
                <div class="ann-modal-quote">"${escapeHtml(range.selectedText.substring(0, 80))}${range.selectedText.length > 80 ? '...' : ''}"</div>
                <div class="mb-3">
                    <label class="form-label">昵称 <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="ann-nickname" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">批注内容 <span class="text-danger">*</span></label>
                    <textarea class="form-control" id="ann-text" rows="3" required placeholder="写下你的批注..."></textarea>
                </div>
            </div>
            <div class="ann-modal-footer">
                <button class="btn btn-sm btn-secondary" id="ann-modal-cancel">取消</button>
                <button class="btn btn-sm btn-primary" id="ann-modal-submit">提交批注</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.ann-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#ann-modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    modal.querySelector('#ann-modal-submit').addEventListener('click', async () => {
        const nickname = modal.querySelector('#ann-nickname').value.trim();
        const text = modal.querySelector('#ann-text').value.trim();
        if (!nickname || !text) {
            alert('昵称和批注内容不能为空');
            return;
        }
        try {
            const data = await fetchApi('/annotations.php', {
                method: 'POST',
                body: JSON.stringify({
                    post_id: postId,
                    start_offset: range.startOffset,
                    end_offset: range.endOffset,
                    selected_text: range.selectedText,
                    annotation_text: text,
                    author_name: nickname,
                    type: 'annotation'
                })
            });
            currentAnnotations.push(data.annotation);
            refreshHighlights();
            modal.remove();
        } catch (error) {
            alert(`创建失败: ${error.message}`);
        }
    });
}

function refreshHighlights() {
    const contentEl = document.querySelector('.ann-content');
    if (!contentEl) return;
    const rawContent = contentEl.textContent;
    const newHtml = buildHighlightedHtml(rawContent, currentAnnotations);
    contentEl.innerHTML = newHtml;
    renderBadges(contentEl);
}

function renderBadges(contentEl) {
    contentEl.querySelectorAll('.ann-mark').forEach(mark => {
        const ids = mark.dataset.annIds.split(',').map(Number);
        if (ids.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'ann-badge';
            badge.textContent = ids.length;
            mark.appendChild(badge);
        }
    });
}

function showAnnotationSidebar(ids, e) {
    const sidebar = document.getElementById('ann-sidebar');
    const body = document.getElementById('ann-sidebar-body');
    if (!sidebar || !body) return;

    const matched = currentAnnotations.filter(a => ids.includes(Number(a.id)));
    if (matched.length === 0) return;

    activeAnnotationIds = ids;

    let html = '';
    matched.forEach(ann => {
        html += `
            <div class="ann-sidebar-item" data-ann-id="${ann.id}">
                <div class="ann-sidebar-meta">
                    <strong>${escapeHtml(ann.author_name)}</strong>
                    <span class="ann-sidebar-type ${ann.type === 'annotation' ? 'ann-type-annotation' : 'ann-type-highlight'}">
                        ${ann.type === 'annotation' ? '批注' : '高亮'}
                    </span>
                    <small class="text-muted">${formatDate(ann.created_at)}</small>
                    <button class="ann-sidebar-delete" data-ann-id="${ann.id}" title="删除">&times;</button>
                </div>
                <div class="ann-sidebar-quote">"${escapeHtml(ann.selected_text.substring(0, 60))}${ann.selected_text.length > 60 ? '...' : ''}"</div>
                ${ann.annotation_text ? `<div class="ann-sidebar-text">${escapeHtml(ann.annotation_text)}</div>` : ''}
            </div>
        `;
    });
    body.innerHTML = html;

    body.querySelectorAll('.ann-sidebar-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const annId = btn.dataset.annId;
            try {
                await fetchApi('/annotations.php', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: Number(annId) })
                });
                currentAnnotations = currentAnnotations.filter(a => Number(a.id) !== Number(annId));
                refreshHighlights();
                if (currentAnnotations.length === 0 || !currentAnnotations.some(a => ids.includes(Number(a.id)))) {
                    sidebar.classList.remove('ann-sidebar-visible');
                } else {
                    const remainingIds = ids.filter(id => id !== Number(annId));
                    if (remainingIds.length > 0) {
                        showAnnotationSidebar(remainingIds, e);
                    } else {
                        sidebar.classList.remove('ann-sidebar-visible');
                    }
                }
            } catch (error) {
                alert(`删除失败: ${error.message}`);
            }
        });
    });

    const card = document.querySelector('.ann-content').closest('.card');
    const cardRect = card.getBoundingClientRect();
    const markEl = e.target.closest('.ann-mark');
    if (markEl) {
        const markRect = markEl.getBoundingClientRect();
        sidebar.style.top = `${markRect.top + window.scrollY}px`;
    }

    const mainCol = document.querySelector('.col-lg-8, .col-md-10');
    if (mainCol) {
        const colRect = mainCol.getBoundingClientRect();
        const sidebarLeft = colRect.right + window.scrollX + 12;
        const sidebarRight = sidebarLeft + 280;
        if (sidebarRight > window.innerWidth) {
            sidebar.style.left = `${colRect.left + window.scrollX - 292}px`;
        } else {
            sidebar.style.left = `${sidebarLeft}px`;
        }
    }

    sidebar.classList.add('ann-sidebar-visible');
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const content = document.getElementById('content').value.trim();
    const alertBox = document.getElementById('alert-box');

    try {
        const body = {
            post_id: postId,
            nickname,
            content
        };
        
        if (replyToCommentId) {
            body.parent_id = replyToCommentId;
        }

        const result = await fetchApi('/comments.php', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        document.getElementById('content').value = '';
        const successMsg = replyToCommentId ? '回复发布成功！' : '评论发布成功！';
        alertBox.innerHTML = `<div class="alert alert-success">${successMsg}</div>`;
        setTimeout(() => {
            const alertEl = alertBox.querySelector('.alert');
            if (alertEl) alertEl.remove();
        }, 2000);

        replyToCommentId = null;
        
        if (result.comment) {
            const newComment = result.comment;
            allComments.push(newComment);
            authorMap.set(Number(newComment.id), newComment.author_name);
            
            if (Number(newComment.id) > danmakuMaxId) {
                danmakuMaxId = Number(newComment.id);
            }
            
            refreshComments();
            
            if (isDanmakuMode && danmakuEngine) {
                danmakuEngine.addComment(newComment, true);
            }
        }
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function initDanmakuUI() {
    const toggle = document.getElementById('danmaku-toggle');
    if (!toggle) return;

    toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            enableDanmakuMode();
        } else {
            disableDanmakuMode();
        }
    });

    const pauseBtn = document.getElementById('danmaku-pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', toggleDanmakuPause);
    }

    const closeBtn = document.getElementById('danmaku-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const toggleEl = document.getElementById('danmaku-toggle');
            if (toggleEl) toggleEl.checked = false;
            disableDanmakuMode();
        });
    }

    const speedSlider = document.getElementById('danmaku-speed');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            document.getElementById('danmaku-speed-val').textContent = val.toFixed(1) + 'x';
            if (danmakuEngine) danmakuEngine.setSpeedScale(val);
        });
    }

    const opacitySlider = document.getElementById('danmaku-opacity');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            document.getElementById('danmaku-opacity-val').textContent = Math.round(val * 100) + '%';
            if (danmakuEngine) danmakuEngine.setOpacity(val);
        });
    }
}

function enableDanmakuMode() {
    const contentWrapper = document.getElementById('post-content-wrapper');
    if (!contentWrapper) return;

    isDanmakuMode = true;
    contentWrapper.classList.add('danmaku-active');

    const controls = document.getElementById('danmaku-controls');
    if (controls) controls.style.display = 'block';

    danmakuEngine = new DanmakuEngine(contentWrapper, {
        opacity: Number(document.getElementById('danmaku-opacity')?.value || 0.9),
        speedScale: Number(document.getElementById('danmaku-speed')?.value || 1)
    });

    const shuffled = [...allComments].sort(() => Math.random() - 0.5);
    const delayStep = Math.max(80, 2000 / Math.max(1, shuffled.length));
    shuffled.forEach((comment, idx) => {
        setTimeout(() => {
            if (danmakuEngine && isDanmakuMode) {
                danmakuEngine.addComment(comment);
            }
        }, idx * delayStep);
    });

    startDanmakuPolling();

    window.addEventListener('resize', handleDanmakuResize);
}

function disableDanmakuMode() {
    isDanmakuMode = false;

    stopDanmakuPolling();

    if (danmakuEngine) {
        danmakuEngine.destroy();
        danmakuEngine = null;
    }

    const contentWrapper = document.getElementById('post-content-wrapper');
    if (contentWrapper) contentWrapper.classList.remove('danmaku-active');

    const controls = document.getElementById('danmaku-controls');
    if (controls) controls.style.display = 'none';

    window.removeEventListener('resize', handleDanmakuResize);
}

function toggleDanmakuPause() {
    if (!danmakuEngine) return;
    const isPlaying = danmakuEngine.togglePause();
    const btn = document.getElementById('danmaku-pause-btn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
        }
        btn.classList.toggle('btn-outline-secondary', isPlaying);
        btn.classList.toggle('btn-outline-success', !isPlaying);
        btn.title = isPlaying ? '暂停' : '继续';
    }
}

let resizeTimeout = null;
function handleDanmakuResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (danmakuEngine) danmakuEngine.resize();
    }, 150);
}

function startDanmakuPolling() {
    stopDanmakuPolling();
    pollNewComments();
    danmakuPollTimer = setInterval(pollNewComments, 3000);
}

function stopDanmakuPolling() {
    if (danmakuPollTimer) {
        clearInterval(danmakuPollTimer);
        danmakuPollTimer = null;
    }
}

async function pollNewComments() {
    if (!isDanmakuMode) return;
    try {
        const data = await fetchApi(`/comments.php?post_id=${postId}&since_id=${danmakuMaxId}`);
        if (data.comments && data.comments.length > 0) {
            const existingIds = new Set(allComments.map(c => String(c.id)));
            let hasNewComments = false;
            
            data.comments.forEach(comment => {
                const cid = String(comment.id);
                if (!existingIds.has(cid)) {
                    allComments.push(comment);
                    authorMap.set(Number(comment.id), comment.author_name);
                    hasNewComments = true;
                }
                if (danmakuEngine) {
                    danmakuEngine.addComment(comment, true);
                }
            });
            
            if (Number(data.max_id) > danmakuMaxId) {
                danmakuMaxId = Number(data.max_id);
            }
            
            if (hasNewComments && currentViewMode === 'list') {
                renderPost(currentPostData);
            }
            
            updateCommentCount();
        }
    } catch (err) {
    }
}

function appendCommentToList(comment) {
    const list = document.getElementById('comments-list');
    if (!list) return;

    const emptyTip = list.querySelector('.text-muted.mb-4');
    if (emptyTip && emptyTip.textContent.includes('暂无评论')) {
        emptyTip.remove();
    }

    const card = document.createElement('div');
    card.className = 'card mb-3 bg-light fade-in';
    card.innerHTML = `
        <div class="card-body py-2">
            <div class="d-flex justify-content-between">
                <strong>${escapeHtml(comment.author_name)}</strong>
                <small class="text-muted">${formatDate(comment.created_at)}</small>
            </div>
            <p class="mb-0 mt-1">${escapeHtml(comment.content)}</p>
        </div>
    `;
    list.appendChild(card);
}

function updateCommentCount() {
    const header = document.querySelector('#comments-section h4');
    if (header) {
        header.textContent = `评论区 (${allComments.length})`;
    }
}
