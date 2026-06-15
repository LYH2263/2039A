<?php
/**
 * 管理员登录接口 api/login.php
 * 
 * 用途：
 * 处理管理员登录请求和检查登录状态。
 * 
 * 核心逻辑：
 * - POST: 验证用户名密码，成功则设置 Session。
 * - GET: 返回当前 Session 登录状态。
 * 
 * 异常处理：
 * - 401 Unauthorized: 用户名或密码错误。
 */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 核心逻辑：登录验证
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    if ($username === ADMIN_USER && $password === ADMIN_PASS) {
        $_SESSION['is_admin'] = true;
        jsonResponse(['message' => 'Login successful', 'success' => true]);
    } else {
        // 异常处理：凭证错误
        jsonResponse(['error' => 'Invalid credentials', 'success' => false], 401);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Check login status
    // 核心逻辑：检查会话状态
    if (isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true) {
        jsonResponse(['logged_in' => true]);
    } else {
        jsonResponse(['logged_in' => false]);
    }
}
?>