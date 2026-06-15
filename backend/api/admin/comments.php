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
    
    // 核心逻辑：删除评论前处理子回复的归属
    // 策略：将直接子回复提升一级（parent_id 设置为被删除评论的 parent_id）
    // 避免 ON DELETE CASCADE 导致整栋楼被删
    
    $conn->begin_transaction();
    
    try {
        // 获取被删除评论的 parent_id
        $stmt = $conn->prepare("SELECT parent_id, post_id FROM comments WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            $conn->rollback();
            jsonResponse(['error' => 'Comment not found'], 404);
        }
        $comment = $result->fetch_assoc();
        $new_parent_id = $comment['parent_id'];
        $post_id = $comment['post_id'];
        
        // 将直接子回复的 parent_id 设置为被删除评论的 parent_id（提升一级）
        $stmt = $conn->prepare("UPDATE comments SET parent_id = ? WHERE parent_id = ?");
        $null_val = null;
        if ($new_parent_id === null) {
            $stmt->bind_param("ii", $null_val, $id);
        } else {
            $stmt->bind_param("ii", $new_parent_id, $id);
        }
        $stmt->execute();
        $replies_promoted = $stmt->affected_rows > 0;
        
        // 删除评论
        $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        
        $conn->commit();
        jsonResponse(['message' => 'Comment deleted', 'replies_promoted' => $replies_promoted]);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => 'Failed to delete: ' . $e->getMessage()], 500);
    }
}
?>