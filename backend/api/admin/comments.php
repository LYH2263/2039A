<?php
/**
 * 后台评论管理接口 api/admin/comments.php
 * 
 * 用途：
 * 管理员获取所有评论列表及删除评论。
 * 
 * 核心逻辑：
 * 1. 鉴权：check_admin_auth()
 * 2. GET: 联表查询 comments 和 posts（获取帖子标题），按时间倒序
 * 3. DELETE: 删除指定 ID 的评论
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录
 * - 400 Bad Request: 删除时 ID 缺失
 */

require_once '../../db.php';
check_admin_auth();

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // List all comments with post titles
    // 核心逻辑：获取评论列表（带所属帖子标题）
    $sql = "SELECT c.*, p.title as post_title FROM comments c LEFT JOIN posts p ON c.post_id = p.id ORDER BY c.created_at DESC";
    $result = $conn->query($sql);
    $comments = [];
    while($row = $result->fetch_assoc()) {
        $comments[] = $row;
    }
    jsonResponse(['comments' => $comments]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    // 异常处理：参数校验
    if (!isset($_GET['id'])) jsonResponse(['error' => 'Missing ID'], 400);
    $id = (int)$_GET['id'];
    
    // 核心逻辑：删除评论
    $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        jsonResponse(['message' => 'Comment deleted']);
    } else {
        jsonResponse(['error' => 'Failed to delete'], 500);
    }
}
?>