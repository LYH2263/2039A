<?php
/**
 * 管理员登出接口 api/logout.php
 * 
 * 用途：
 * 销毁管理员会话，退出登录。
 * 
 * 核心逻辑：
 * 调用 session_destroy() 销毁当前会话。
 */

require_once '../config.php';
session_destroy();
jsonResponse(['message' => 'Logged out']);
?>