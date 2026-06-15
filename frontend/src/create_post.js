import { fetchApi } from './config.js';
import { renderHeader } from './header.js';

renderHeader('create');

const app = document.getElementById('app');

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

document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const author = document.getElementById('author').value.trim();
    const content = document.getElementById('content').value.trim();
    const alertBox = document.getElementById('alert-box');

    try {
        const data = await fetchApi('/posts.php', {
            method: 'POST',
            body: JSON.stringify({ title, author, content })
        });
        window.location.href = `/post.html?id=${data.id}`;
    } catch (error) {
        alertBox.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
});
