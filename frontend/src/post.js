import { fetchApi, formatDate } from './config.js';
import { renderHeader } from './header.js';

renderHeader();

const app = document.getElementById('app');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

if (!postId) {
    app.innerHTML = '<div class="alert alert-danger">无效的帖子ID</div>';
} else {
    loadPost(postId);
}

async function loadPost(id) {
    try {
        const data = await fetchApi(`/post.php?id=${id}`);
        renderPost(data);
    } catch (error) {
        app.innerHTML = `<div class="alert alert-danger">加载失败: ${error.message}</div>`;
    }
}

function renderPost({ post, comments }) {
    document.title = `${post.title} - 极简论坛`;
    
    let html = `
        <div class="row justify-content-center">
            <div class="col-md-10">
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
                        <div class="card-text" style="white-space: pre-wrap;">${escapeHtml(post.content)}</div>
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
    </div></div>`;

    app.innerHTML = html;

    document.getElementById('comment-form').addEventListener('submit', handleCommentSubmit);
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
        // Reload page to show new comment
        window.location.reload();
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
