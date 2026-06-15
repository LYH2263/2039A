import { fetchApi } from './config.js';

export function renderAdminHeader(activeLink = '') {
    const nav = document.createElement('nav');
    nav.className = 'navbar navbar-expand-lg navbar-light bg-white shadow-sm mb-4 py-3';
    nav.innerHTML = `
        <div class="container">
            <a class="navbar-brand d-flex align-items-center fw-bold text-primary" href="/admin/index.html">
                <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-speedometer2" viewBox="0 0 16 16">
                      <path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/>
                      <path fill-rule="evenodd" d="M0 10a8 8 0 1 1 15.547 2.661c-.442 1.253-1.845 1.602-2.932 1.25C11.309 13.488 9.475 13 8 13c-1.474 0-3.31.488-4.615.911-1.087.352-2.49.003-2.932-1.25A7.988 7.988 0 0 1 0 10zm8-7a7 7 0 0 0-6.603 9.329c.203.575.923.876 1.68.92C4.397 13.205 6.092 12.8 8 12.8c1.908 0 3.603.405 4.923.45.757-.044 1.477-.345 1.68-.92A7 7 0 0 0 8 3z"/>
                    </svg>
                </div>
                <span style="background: linear-gradient(45deg, #4f46e5, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">论坛后台</span>
            </a>
            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto align-items-center">
                    <li class="nav-item me-2">
                        <a class="nav-link px-3 rounded-pill hover-bg-light" href="/" target="_blank">
                            <i class="bi bi-box-arrow-up-right me-1"></i> 前台首页
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link btn btn-outline-danger text-danger px-4 rounded-pill border-danger-subtle" href="#" id="logout-btn" style="min-width: 100px; text-align: center;">
                            退出
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    `;
    document.body.prepend(nav);

    document.getElementById('logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetchApi('/logout.php');
            window.location.href = '/admin/login.html';
        } catch (error) {
            console.error(error);
        }
    });
}
