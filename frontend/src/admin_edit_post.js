import { fetchApi } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader();

const app = document.getElementById('app');
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

if (!postId) {
    app.innerHTML = '<div class="container mt-5"><div class="alert alert-danger">无效的帖子ID</div></div>';
} else {
    loadPost(postId);
}

async function loadPost(id) {
    try {
        const data = await fetchApi(`/post.php?id=${id}`);
        renderEditForm(data.post);
    } catch (error) {
        app.innerHTML = `<div class="container mt-5"><div class="alert alert-danger">加载失败: ${error.message}</div></div>`;
    }
}

function renderEditForm(post) {
    app.innerHTML = `
    <div class="container mt-5 fade-in">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card shadow-lg border-0 rounded-lg">
                    <div class="card-header bg-white border-bottom-0 pt-4 pb-2 px-4">
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-primary bg-opacity-10 p-2 me-3 text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                  <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                                  <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                                </svg>
                            </div>
                            <h4 class="mb-0 fw-bold text-gradient">编辑帖子</h4>
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
                                <label for="content" class="form-label text-secondary fw-medium">内容</label>
                                <textarea class="form-control bg-light border-0" id="content" rows="12" required placeholder="请输入内容">${escapeHtml(post.content)}</textarea>
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
}

async function handleUpdate(e) {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const alertBox = document.getElementById('alert-box');

    try {
        await fetchApi('/admin/posts.php', {
            method: 'PUT',
            body: JSON.stringify({
                id: postId,
                title,
                content
            })
        });
        window.location.href = '/admin/posts.html';
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
