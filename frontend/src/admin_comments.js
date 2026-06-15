import { fetchApi, formatDate, escapeHtml } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader('comments');

const app = document.getElementById('app');

async function loadComments() {
    try {
        const data = await fetchApi('/admin/comments.php');
        renderComments(data.comments);
    } catch (error) {
        app.innerHTML = `<div class="container mt-4"><div class="alert alert-danger shadow-sm">${error.message}</div></div>`;
    }
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

function renderComments(comments) {
    const postMap = new Map();
    comments.forEach(c => {
        if (c.post_title) {
            postMap.set(Number(c.post_id), c.post_title);
        }
    });
    
    const authorMap = new Map();
    comments.forEach(c => {
        authorMap.set(Number(c.id), c.author_name);
    });
    
    const tree = buildCommentTree(comments);
    
    let html = `
    <div class="container fade-in py-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-dark mb-0">评论管理</h3>
                <p class="text-muted small mb-0">管理所有用户评论 (共 ${comments.length} 条)</p>
            </div>
            <a href="/admin/index.html" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-left"></i> 返回仪表盘
            </a>
        </div>
        
        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0 align-middle">
                        <thead class="bg-light">
                            <tr>
                                <th class="ps-4">ID</th>
                                <th>所属帖子</th>
                                <th>类型</th>
                                <th>评论昵称</th>
                                <th>评论内容</th>
                                <th>时间</th>
                                <th class="text-end pe-4">操作</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    const renderRow = (comment, depth = 0) => {
        const isReply = comment.parent_id !== null && comment.parent_id !== undefined;
        const indent = depth * 20;
        
        let rowHtml = `
            <tr style="${depth > 0 ? 'background: #fafafa;' : ''}">
                <td class="ps-4 fw-bold text-muted">
                    ${depth > 0 ? '<span class="text-muted me-1">└─</span>' : ''}#${comment.id}
                </td>
                <td>
                    ${comment.post_title ? 
                        `<a href="/post.html?id=${comment.post_id}" target="_blank" class="text-decoration-none fw-medium text-dark">${escapeHtml(comment.post_title.substring(0, 20))}${comment.post_title.length > 20 ? '...' : ''}</a>` : 
                        '<span class="badge bg-secondary">帖子已删除</span>'}
                </td>
                <td>
                    ${isReply ? 
                        `<span class="badge bg-info text-white">回复 @${escapeHtml(authorMap.get(Number(comment.parent_id)) || '评论')}</span>` : 
                        '<span class="badge bg-primary">评论</span>'}
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2 bg-light text-success rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-weight: bold; font-size: 14px;">
                            ${escapeHtml(comment.author_name).charAt(0).toUpperCase()}
                        </div>
                        <span>${escapeHtml(comment.author_name)}</span>
                    </div>
                </td>
                <td class="text-muted small">${escapeHtml(comment.content.substring(0, 50))}${comment.content.length > 50 ? '...' : ''}</td>
                <td class="text-muted small">${formatDate(comment.created_at)}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${comment.id}">删除</button>
                </td>
            </tr>
        `;
        
        if (comment.children && comment.children.length > 0) {
            comment.children.forEach(child => {
                rowHtml += renderRow(child, depth + 1);
            });
        }
        
        return rowHtml;
    };
    
    if (comments.length === 0) {
        html += `<tr><td colspan="7" class="text-center py-4 text-muted">暂无评论</td></tr>`;
    } else {
        tree.forEach(comment => {
            html += renderRow(comment);
        });
    }

    html += `</tbody></table></div></div></div></div>`;
    app.innerHTML = html;

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('确定要删除这条评论吗？删除后其直接子回复将提升一级。')) {
                const id = e.target.getAttribute('data-id');
                try {
                    await fetchApi(`/admin/comments.php?id=${id}`, { method: 'DELETE' });
                    loadComments();
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });
}

loadComments();
