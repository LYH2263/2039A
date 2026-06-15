export function renderHeader(activeLink = '') {
    const nav = document.createElement('nav');
    nav.className = 'navbar navbar-expand-lg navbar-light bg-white mb-4 shadow-sm';
    nav.innerHTML = `
        <div class="container">
            <a class="navbar-brand" href="/">极简论坛</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link ${activeLink === 'home' ? 'active' : ''}" href="/">首页</a></li>
                    <li class="nav-item"><a class="nav-link ${activeLink === 'create' ? 'active' : ''}" href="/create_post.html">发布新帖</a></li>
                    <li class="nav-item"><a class="nav-link" href="/admin/index.html">后台管理</a></li>
                </ul>
            </div>
        </div>
    `;
    document.body.prepend(nav);
}
