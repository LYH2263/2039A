import { fetchApi } from './config.js';
import { renderAdminHeader } from './admin_header.js';
import './styles.css';

renderAdminHeader('dashboard');

const app = document.getElementById('app');

async function loadStats() {
    try {
        const stats = await fetchApi('/admin/stats.php');
        renderStats(stats);
    } catch (error) {
        app.innerHTML = `<div class="container mt-4"><div class="alert alert-danger shadow-sm">${error.message}</div></div>`;
    }
}

function renderStats(stats) {
    const pendingReports = stats.pending_report_count || 0;
    app.innerHTML = `
    <div class="container fade-in py-4">
        <div class="row mb-4">
            <div class="col-md-12">
                <h2 class="fw-bold text-dark">仪表盘</h2>
                <p class="text-muted">欢迎回来，管理员。这里是论坛的概览。</p>
            </div>
        </div>

        <div class="row">
            <div class="col-md-4 mb-4">
                <div class="card h-100 border-0">
                    <div class="card-body p-4 text-center">
                        <div class="mb-3 text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-file-text" viewBox="0 0 16 16">
                                <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5v-2z"/>
                                <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
                            </svg>
                        </div>
                        <h5 class="card-title text-muted text-uppercase small fw-bold">帖子总数</h5>
                        <h1 class="display-4 fw-bold text-dark mb-4">${stats.post_count}</h1>
                        <a href="/admin/posts.html" class="btn btn-primary w-100">管理帖子</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 border-0">
                    <div class="card-body p-4 text-center">
                        <div class="mb-3 text-success">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-chat-dots" viewBox="0 0 16 16">
                                <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                                <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9.06 9.06 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.437 10.437 0 0 1-.524 2.318l-.003.011a10.722 10.722 0 0 1-.244.637c-.079.186.074.394.273.362a21.673 21.673 0 0 0 .693-.125zm.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6c0 3.193-3.004 6-7 6a8.06 8.06 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a10.97 10.97 0 0 0 .398-1.876z"/>
                            </svg>
                        </div>
                        <h5 class="card-title text-muted text-uppercase small fw-bold">评论总数</h5>
                        <h1 class="display-4 fw-bold text-dark mb-4">${stats.comment_count}</h1>
                        <a href="/admin/comments.html" class="btn btn-primary w-100">管理评论</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card h-100 border-0 ${pendingReports > 0 ? 'border border-warning' : ''}">
                    <div class="card-body p-4 text-center position-relative">
                        ${pendingReports > 0 ? `
                            <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-danger p-2" style="font-size: 0.75rem;">
                                待处理 ${pendingReports}
                            </span>
                        ` : ''}
                        <div class="mb-3 ${pendingReports > 0 ? 'text-warning' : 'text-secondary'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-flag-fill" viewBox="0 0 16 16">
                                <path d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464L14.5 8l.186.464-.003.001-.006.003-.023.009a12.435 12.435 0 0 1-.397.15c-.264.095-.631.223-1.047.35-.816.252-1.879.523-2.71.523-.847 0-1.548-.28-2.158-.525l-.028-.01C7.68 8.71 7.14 8.5 6.5 8.5c-.7 0-1.638.23-2.437.477A19.626 19.626 0 0 0 3 9.342V15.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0v.282c.226-.079.496-.17.79-.26C4.606.272 5.67 0 6.5 0c.84 0 1.523.277 2.121.519l.043.018C9.286.788 9.828 1 10.5 1c.7 0 1.638-.23 2.437-.477a19.587 19.587 0 0 0 1.349-.476l.019-.007.004-.002h.001M14 1.221c-.22.078-.48.167-.766.255-.81.252-1.872.523-2.734.523-.886 0-1.592-.286-2.203-.534l-.008-.003C7.662 1.21 7.139 1 6.5 1c-.669 0-1.606.229-2.415.478A21.294 21.294 0 0 0 3 1.845v6.433c.22-.078.48-.167.766-.255C4.576 7.77 5.638 7.5 6.5 7.5c.847 0 1.548.28 2.158.525l.028.01C9.32 8.29 9.86 8.5 10.5 8.5c.668 0 1.606-.229 2.415-.478A21.317 21.317 0 0 0 14 7.655V1.222z"/>
                            </svg>
                        </div>
                        <h5 class="card-title text-muted text-uppercase small fw-bold">举报待处理</h5>
                        <h1 class="display-4 fw-bold ${pendingReports > 0 ? 'text-warning' : 'text-dark'} mb-4">${pendingReports}</h1>
                        <a href="/admin/reports.html" class="btn ${pendingReports > 0 ? 'btn-warning' : 'btn-outline-primary'} w-100">
                            ${pendingReports > 0 ? '<i class="bi bi-exclamation-triangle me-1"></i>立即处理' : '查看举报'}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

loadStats();
