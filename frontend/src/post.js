import { fetchApi, formatDate } from './config.js';
import { renderHeader } from './header.js';

renderHeader();

const app = document.getElementById('app');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

let currentAnnotations = [];
let activeAnnotationIds = [];

if (!postId) {
    app.innerHTML = '<div class="alert alert-danger">无效的帖子ID</div>';
} else {
    loadPost(postId);
}

async function loadPost(id) {
    try {
        const [postData, annotationData] = await Promise.all([
            fetchApi(`/post.php?id=${id}`),
            fetchApi(`/annotations.php?post_id=${id}`)
        ]);
        currentAnnotations = annotationData.annotations || [];
        renderPost(postData);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
                        <h1 class="card-title mb-3">${escapeHtml(post.title)}</h1>
                        <h6 class="card-subtitle mb-4 text-muted">
                            作者: ${escapeHtml(post.author_name)} |
                            发布于: ${formatDate(post.created_at)}
                        </h6>
                        <div class="card-text ann-content" style="white-space: pre-wrap;">${contentHtml}</div>
                    </div>
                </div>

                <h4 class="mb-3">评论区 (${comments.length})</h4>
    `;

    if (comments.length === 0) {
        html += `<p class="text-muted mb-4">暂无评论，抢沙发！</p>`;
    } else {
        comments.forEach(comment => {
            html += `
                <div class="card mb-3 bg-light">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between">
                            <strong>${escapeHtml(comment.author_name)}</strong>
                            <small class="text-muted">${formatDate(comment.created_at)}</small>
                        </div>
                        <p class="mb-0 mt-1">${escapeHtml(comment.content)}</p>
                    </div>
                </div>
            `;
        });
    }

    html += `
        <div class="card mt-4">
            <div class="card-header">发表评论</div>
            <div class="card-body">
                <div id="alert-box"></div>
                <form id="comment-form">
                    <div class="mb-3">
                        <label for="nickname" class="form-label">昵称 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="nickname" required>
                    </div>
                    <div class="mb-3">
                        <label for="content" class="form-label">评论内容 <span class="text-danger">*</span></label>
                        <textarea class="form-control" id="content" rows="3" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">提交评论</button>
                </form>
            </div>
        </div>
    </div></div>
    `;

    app.innerHTML = html;

    initAnnotationUI(post);
    document.getElementById('comment-form').addEventListener('submit', handleCommentSubmit);
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
        await fetchApi('/comments.php', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId,
                nickname,
                content
            })
        });
        window.location.reload();
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}
