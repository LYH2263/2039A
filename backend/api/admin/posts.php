<?php
/**
 * 后台帖子管理接口 api/admin/posts.php
 * 
 * 用途：
 * 管理员对帖子进行删除和更新操作。
 * 
 * 核心逻辑：
 * 1. 鉴权：调用 check_admin_auth() 确保管理员登录
 * 2. DELETE: 删除指定 ID 的帖子
 * 3. PUT: 更新指定 ID 的帖子标题和内容
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录（由 check_admin_auth 处理）
 * - 400 Bad Request: ID 缺失或更新数据不完整
 * - 500 Internal Server Error: 数据库操作失败
 */

require_once '../../db.php';
check_admin_auth();

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // 异常处理：参数校验
    if (!isset($_GET['id'])) jsonResponse(['error' => 'Missing ID'], 400);
    $id = (int)$_GET['id'];
    
    // 核心逻辑：删除帖子
    $stmt = $conn->prepare("DELETE FROM posts WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        jsonResponse(['message' => 'Post deleted']);
    } else {
        jsonResponse(['error' => 'Failed to delete'], 500);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['id'])) jsonResponse(['error' => 'Missing ID'], 400);
    
    $id = (int)$input['id'];
    $title = trim($input['title'] ?? '');
    $content = trim($input['content'] ?? '');
    
    // 异常处理：字段校验
    if (empty($title) || empty($content)) {
        jsonResponse(['error' => 'Title and Content required'], 400);
    }
    
    // 核心逻辑：更新帖子
    $stmt = $conn->prepare("UPDATE posts SET title = ?, content = ? WHERE id = ?");
    $stmt->bind_param("ssi", $title, $content, $id);
    if ($stmt->execute()) {
        jsonResponse(['message' => 'Post updated']);
    } else {
        jsonResponse(['error' => 'Failed to update'], 500);
    }
}
?>