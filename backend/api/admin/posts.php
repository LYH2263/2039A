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
 * 3. PUT: 更新指定 ID 的帖子标题、内容和标签
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录（由 check_admin_auth 处理）
 * - 400 Bad Request: ID 缺失或更新数据不完整
 * - 500 Internal Server Error: 数据库操作失败
 */

require_once '../../db.php';
require_once '../tag_functions.php';
check_admin_auth();

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (!isset($_GET['id'])) jsonResponse(['error' => 'Missing ID'], 400);
    $id = (int)$_GET['id'];
    
    $conn->begin_transaction();
    try {
        $old_tag_ids = [];
        $result = $conn->query("SELECT tag_id FROM post_tags WHERE post_id = $id");
        while ($row = $result->fetch_assoc()) {
            $old_tag_ids[] = $row['tag_id'];
        }
        
        $stmt = $conn->prepare("DELETE FROM posts WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        
        foreach ($old_tag_ids as $tag_id) {
            updateTagPostCount($conn, $tag_id);
        }
        
        $conn->commit();
        jsonResponse(['message' => 'Post deleted']);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => 'Failed to delete: ' . $e->getMessage()], 500);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['id'])) jsonResponse(['error' => 'Missing ID'], 400);
    
    $id = (int)$input['id'];
    $title = trim($input['title'] ?? '');
    $content = trim($input['content'] ?? '');
    $tags = isset($input['tags']) && is_array($input['tags']) ? $input['tags'] : null;
    $revision_note = isset($input['revision_note']) ? trim($input['revision_note']) : null;
    
    if (empty($title) || empty($content)) {
        jsonResponse(['error' => 'Title and Content required'], 400);
    }
    
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT title, content FROM posts WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $old_post = $stmt->get_result()->fetch_assoc();
        
        if (!$old_post) {
            jsonResponse(['error' => 'Post not found'], 404);
        }
        
        $has_changes = $old_post['title'] !== $title || $old_post['content'] !== $content || $tags !== null;
        
        if ($has_changes) {
            $old_tags = getTagsForPost($conn, $id);
            $old_tags_names = array_map(function($t) { return $t['display_name']; }, $old_tags);
            $tags_snapshot = json_encode($old_tags_names, JSON_UNESCAPED_UNICODE);
            $admin_name = $_SESSION['admin_username'] ?? 'admin';
            
            $rev_stmt = $conn->prepare("INSERT INTO post_revisions (post_id, title, content, tags_snapshot, revision_note, created_by) VALUES (?, ?, ?, ?, ?, ?)");
            $rev_stmt->bind_param("isssss", $id, $old_post['title'], $old_post['content'], $tags_snapshot, $revision_note, $admin_name);
            $rev_stmt->execute();
        }
        
        $stmt = $conn->prepare("UPDATE posts SET title = ?, content = ? WHERE id = ?");
        $stmt->bind_param("ssi", $title, $content, $id);
        $stmt->execute();
        
        if ($tags !== null) {
            syncPostTags($conn, $id, $tags);
        }
        
        $conn->commit();
        jsonResponse(['message' => 'Post updated', 'revision_saved' => $has_changes]);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => 'Failed to update: ' . $e->getMessage()], 500);
    }
}
?>