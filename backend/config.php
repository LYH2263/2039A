<?php
/**
 * 配置文件 config.php
 * 
 * 用途：
 * 1. 定义数据库连接常量 (DB_HOST, DB_NAME, etc.)
 * 2. 定义管理员账号常量 (ADMIN_USER, ADMIN_PASS)
 * 3. 配置 CORS 跨域头，允许前端访问
 * 4. 开启 Session
 * 5. 提供通用辅助函数 jsonResponse 和 check_admin_auth
 * 
 * 核心逻辑：
 * - 检测 HTTP_ORIGIN 实现动态 CORS 允许
 * - session_start() 启动会话
 * 
 * 异常处理：
 * - 401 Unauthorized: check_admin_auth() 在未登录时返回
 */

// Database configuration
// 数据库连接配置
define('DB_HOST', 'db'); 
define('DB_NAME', 'www.17speed.vip');
define('DB_USER', 'www.17speed.vip');
define('DB_PASS', '19821230a');

// Admin credentials
// 管理员账号配置
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', '123456');

// CORS Headers
// 跨域资源共享配置
// 核心逻辑：允许来自前端 (localhost:3000) 的请求携带凭证 (Cookie)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Max-Age: 86400");    // cache for 1 day
}

header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Handle Preflight
// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * 辅助函数：返回 JSON 响应并结束脚本
 * 
 * @param mixed $data 响应数据
 * @param int $status HTTP 状态码 (默认 200)
 */
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Session for Admin
// 开启 Session 用于后台登录状态维持
session_start();

/**
 * 辅助函数：检查管理员权限
 * 
 * 逻辑：检查 $_SESSION['is_admin'] 是否为 true
 * 异常处理：若未登录，直接返回 401 Unauthorized JSON 响应
 */
function check_admin_auth() {
    if (!isset($_SESSION['is_admin']) || $_SESSION['is_admin'] !== true) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
}
?>