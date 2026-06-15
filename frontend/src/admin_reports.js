import { fetchApi, formatDate, escapeHtml } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader('reports');

const app = document.getElementById('app');
let currentTab = 'pending';

const REASON_LABELS = {
    spam: '垃圾广告',
    abuse: '辱骂攻击',
    porn: '色情低俗',
    violence: '暴力血腥',
    illegal: '违法违规',
    privacy: '侵犯隐私',
    copyright: '侵犯版权',
    other: '其他问题'
};

function getReasonBadge(reason) {
    const colors = {
        spam: 'bg-warning',
        abuse: 'bg-danger',
        porn: 'bg-purple',
        violence: 'bg-red',
        illegal: 'bg-dark',
        privacy: 'bg-info',
        copyright: 'bg-secondary',
        other: 'bg-light text-dark border'
    };
    const cls = colors[reason] || 'bg-light text-dark border';
    const styleFix = reason === 'porn' ? 'background: #9333ea; color: white;' :
                      reason === 'violence' ? 'background: #dc2626; color: white;' : '';
    return `<span class="badge ${cls} me-1" ${styleFix ? ` style="${styleFix}"` : ''}>${REASON_LABELS[reason] || reason}</span>`;
}

function renderReasonsGrouped(reasonsStr, count) {
    if (!reasonsStr) return '';
    const reasons = reasonsStr.split('|').filter(Boolean);
    const uniq = [...new Set(reasons)];
    let html = uniq.map(r => getReasonBadge(r)).join('');
    if (count > 1) {
        html += `<span class="badge bg-primary me-1">共 ${count} 人举报</span>`;
    }
    return html;
}

async function loadReports(tab) {
    try {
        const data = await fetchApi(`/admin/reports.php?status=${tab}`);
        renderReports(data.reports, data.stats, tab);
    } catch (error) {
        app.innerHTML = `<div class="container mt-4"><div class="alert alert-danger shadow-sm">${error.message}</div></div>`;
    }
}

function renderReports(reports, stats, tab) {
    const pendingCount = stats?.pending_count ?? 0;
    const handledCount = stats?.handled_count ?? 0;

    let html = `
    <div class="container fade-in py-4">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
                <h3 class="fw-bold text-dark mb-0">举报管理</h3>
                <p class="text-muted small mb-0">处理用户提交的举报内容</p>
            </div>
            <a href="/admin/index.html" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> 返回仪表盘
            </a>
        </div>

        <ul class="nav nav-tabs mb-4" id="report-tabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link ${tab === 'pending' ? 'active' : ''}" 
                        id="pending-tab" data-tab="pending" type="button" role="tab">
                    <i class="bi bi-hourglass-split me-1"></i> 待处理
                    <span class="badge bg-danger ms-1">${pendingCount}</span>
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link ${tab === 'handled' ? 'active' : ''}" 
                        id="handled-tab" data-tab="handled" type="button" role="tab">
                    <i class="bi bi-check-circle me-1"></i> 已处理
                    <span class="badge bg-secondary ms-1">${handledCount}</span>
                </button>
            </li>
        </ul>

        <div id="alert-container"></div>
    `;

    if (reports.length === 0) {
        html += `
            <div class="card shadow-sm border-0">
                <div class="card-body text-center py-5">
                    <div class="mb-3 text-muted">
                        <i class="bi ${tab === 'pending' ? 'bi-inbox' : 'bi-check2-circle'}" style="font-size: 3rem;"></i>
                    </div>
                    <p class="text-muted mb-0">${tab === 'pending' ? '暂无待处理举报' : '暂无已处理举报'}</p>
                </div>
            </div>
        `;
    } else {
        html += `<div class="card shadow-sm border-0 mb-4"><div class="card-body p-0"><div class="list-group list-group-flush">`;

        reports.forEach(r => {
            const typeBadge = r.target_type === 'post' 
                ? `<span class="badge bg-primary me-2"><i class="bi bi-file-text me-1"></i>帖子</span>`
                : `<span class="badge bg-info me-2"><i class="bi bi-chat-dots me-1"></i>评论</span>`;

            const statusBadge = r.status === 'ignored'
                ? `<span class="badge bg-secondary">已忽略</span>`
                : r.status === 'deleted'
                ? `<span class="badge bg-danger">已删除内容</span>`
                : `<span class="badge bg-warning text-dark">待处理</span>`;

            let targetLink = '';
            if (r.target_exists) {
                if (r.target_type === 'post') {
                    targetLink = `<a href="/post.html?id=${r.target_id}" target="_blank" class="fw-medium text-dark text-decoration-none">
                        ${escapeHtml(r.post_title || '查看帖子')}
                    </a>`;
                } else {
                    targetLink = `<a href="/post.html?id=${r.post_id}#comment-${r.target_id}" target="_blank" class="fw-medium text-dark text-decoration-none">
                        ${escapeHtml(r.post_title || '查看评论所在帖子')}
                    </a>`;
                }
            } else {
                targetLink = `<span class="text-muted"><i class="bi bi-trash me-1"></i>${r.target_type === 'post' ? '帖子' : '评论'}已被删除，下方为快照</span>`;
            }

            const snapshotPreview = r.target_snapshot 
                ? escapeHtml(r.target_snapshot.substring(0, 150)) + (r.target_snapshot.length > 150 ? '...' : '')
                : '';

            const authorInfo = r.target_author 
                ? `<span class="text-muted small">被举报作者: <strong>${escapeHtml(r.target_author)}</strong></span>`
                : '';

            const handledInfo = tab === 'handled'
                ? `<div class="mt-2 pt-2 border-top small text-muted">
                        <i class="bi bi-person-check me-1"></i>处理人: ${escapeHtml(r.handled_by || 'admin')}
                        <span class="mx-2">|</span>
                        <i class="bi bi-clock me-1"></i>处理时间: ${formatDate(r.handled_at)}
                   </div>`
                : '';

            const actions = tab === 'pending' ? `
                <div class="d-flex gap-2 mt-3">
                    <button class="btn btn-sm btn-outline-secondary ignore-btn" data-id="${r.id}" data-type="${r.target_type}" data-target-id="${r.target_id}">
                        <i class="bi bi-x-circle me-1"></i>忽略举报
                    </button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${r.id}" data-type="${r.target_type}" data-target-id="${r.target_id}">
                        <i class="bi bi-trash me-1"></i>删除被举报${r.target_type === 'post' ? '帖子' : '评论'}
                    </button>
                </div>
            ` : '';

            html += `
                <div class="list-group-item p-4" data-report-id="${r.id}">
                    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                        <div class="d-flex align-items-center flex-wrap gap-1">
                            ${typeBadge}
                            ${renderReasonsGrouped(r.same_target_reasons || r.reason, r.same_target_pending_count || 1)}
                            ${statusBadge}
                        </div>
                        <small class="text-muted">
                            <i class="bi bi-calendar3 me-1"></i>${formatDate(r.created_at)}
                        </small>
                    </div>

                    <div class="mb-2">
                        <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                            <span class="text-muted small">举报人:</span>
                            <strong>${escapeHtml(r.reporter_name)}</strong>
                            ${authorInfo ? `<span class="mx-2 text-muted">·</span>${authorInfo}` : ''}
                        </div>
                        ${r.remark ? `
                            <div class="mb-2 p-2 bg-light rounded small" style="border-left: 3px solid #eab308;">
                                <i class="bi bi-chat-left-text me-1 text-warning"></i>
                                <strong>举报说明:</strong> ${escapeHtml(r.remark)}
                            </div>
                        ` : ''}
                    </div>

                    <div class="card bg-light border-0 mb-2">
                        <div class="card-body py-2 px-3">
                            <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-1">
                                <div class="small fw-medium text-muted">
                                    <i class="bi ${r.target_type === 'post' ? 'bi-file-text' : 'bi-chat-dots'} me-1"></i>
                                    被举报${r.target_type === 'post' ? '帖子' : '评论'}
                                </div>
                                ${targetLink}
                            </div>
                            ${snapshotPreview ? `
                                <div class="small text-muted" style="white-space: pre-wrap;">${snapshotPreview}</div>
                            ` : ''}
                            ${r.target_snapshot && r.target_snapshot.length > 150 ? `
                                <button class="btn btn-link btn-sm p-0 mt-1 expand-snapshot-btn" data-report-id="${r.id}">
                                    <i class="bi bi-chevron-down me-1"></i>展开全部快照
                                </button>
                                <div class="d-none mt-2 p-2 bg-white rounded small border" id="snapshot-full-${r.id}" style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">
                                    ${escapeHtml(r.target_snapshot)}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${handledInfo}
                    ${actions}
                </div>
            `;
        });

        html += `</div></div></div></div>`;
    }

    html += `</div>`;
    app.innerHTML = html;

    document.querySelectorAll('#report-tabs .nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const newTab = btn.dataset.tab;
            if (newTab !== currentTab) {
                currentTab = newTab;
                loadReports(currentTab);
            }
        });
    });

    document.querySelectorAll('.ignore-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('确定忽略此举报吗？同内容的其他待处理举报也将被标记为已忽略。')) return;
            const id = Number(btn.dataset.id);
            await handleReport(id, 'ignore');
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.type === 'post' ? '帖子' : '评论';
            if (!confirm(`确定删除被举报的${type}吗？此操作不可撤销，同内容的其他待处理举报也将被标记为已处理。`)) return;
            const id = Number(btn.dataset.id);
            await handleReport(id, 'delete_content');
        });
    });

    document.querySelectorAll('.expand-snapshot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reportId = btn.dataset.reportId;
            const fullEl = document.getElementById(`snapshot-full-${reportId}`);
            const icon = btn.querySelector('i');
            if (fullEl.classList.contains('d-none')) {
                fullEl.classList.remove('d-none');
                icon.className = 'bi bi-chevron-up me-1';
                btn.innerHTML = btn.innerHTML.replace('展开全部快照', '收起快照');
            } else {
                fullEl.classList.add('d-none');
                icon.className = 'bi bi-chevron-down me-1';
                btn.innerHTML = btn.innerHTML.replace('收起快照', '展开全部快照');
            }
        });
    });
}

async function handleReport(id, action) {
    const alertContainer = document.getElementById('alert-container');
    try {
        const result = await fetchApi('/admin/reports.php', {
            method: 'PUT',
            body: JSON.stringify({ id, action })
        });
        alertContainer.innerHTML = `
            <div class="alert alert-success shadow-sm">
                <i class="bi bi-check-circle me-2"></i>${result.message}
            </div>
        `;
        setTimeout(() => loadReports(currentTab), 800);
    } catch (error) {
        alertContainer.innerHTML = `
            <div class="alert alert-danger shadow-sm">
                <i class="bi bi-exclamation-triangle me-2"></i>${error.message}
            </div>
        `;
    }
}

loadReports(currentTab);
