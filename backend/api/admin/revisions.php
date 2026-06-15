<?php
/**
 * 帖子版本历史接口 api/admin/revisions.php
 * 
 * 用途：
 * 管理员对帖子历史版本进行管理：查看列表、查看详情、回滚版本。
 * 
 * 核心逻辑：
 * 1. 鉴权：调用 check_admin_auth() 确保管理员登录
 * 2. GET (list): 获取指定帖子的版本历史列表
 * 3. GET (single): 获取单个版本详情
 * 4. POST (rollback): 回滚到指定版本（会先保存当前版本为新的历史版本）
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录
 * - 400 Bad Request: 参数缺失
 * - 404 Not Found: 版本或帖子不存在
 * - 500 Internal Server Error: 数据库操作失败
 */

require_once '../../db.php';
require_once '../tag_functions.php';
check_admin_auth();

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['id'])) {
        $revision_id = (int)$_GET['id'];
        $stmt = $conn->prepare("SELECT * FROM post_revisions WHERE id = ?");
        $stmt->bind_param("i", $revision_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            jsonResponse(['error' => 'Revision not found'], 404);
        }
        
        $revision = $result->fetch_assoc();
        $revision['tags'] = !empty($revision['tags_snapshot']) ? json_decode($revision['tags_snapshot'], true) : [];
        unset($revision['tags_snapshot']);
        
        jsonResponse($revision);
    } elseif (isset($_GET['post_id'])) {
        $post_id = (int)$_GET['post_id'];
        
        $stmt = $conn->prepare("SELECT id, post_id, title, revision_note, created_by, created_at FROM post_revisions WHERE post_id = ? ORDER BY created_at DESC, id DESC");
        $stmt->bind_param("i", $post_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $revisions = [];
        while ($row = $result->fetch_assoc()) {
            $revisions[] = [
                'id' => (int)$row['id'],
                'post_id' => (int)$row['post_id'],
                'title' => $row['title'],
                'revision_note' => $row['revision_note'],
                'created_by' => $row['created_by'],
                'created_at' => $row['created_at']
            ];
        }
        
        jsonResponse(['revisions' => $revisions, 'total' => count($revisions)]);
    } else {
        jsonResponse(['error' => 'Missing post_id or id parameter'], 400);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    if ($action !== 'rollback' || !isset($input['revision_id'])) {
        jsonResponse(['error' => 'Invalid request'], 400);
    }
    
    $revision_id = (int)$input['revision_id'];
    $admin_name = $_SESSION['admin_username'] ?? 'admin';
    
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT * FROM post_revisions WHERE id = ?");
        $stmt->bind_param("i", $revision_id);
        $stmt->execute();
        $revision_result = $stmt->get_result();
        
        if ($revision_result->num_rows === 0) {
            jsonResponse(['error' => 'Revision not found'], 404);
        }
        
        $revision = $revision_result->fetch_assoc();
        $post_id = (int)$revision['post_id'];
        
        $stmt = $conn->prepare("SELECT title, content FROM posts WHERE id = ?");
        $stmt->bind_param("i", $post_id);
        $stmt->execute();
        $current_post = $stmt->get_result()->fetch_assoc();
        
        if (!$current_post) {
            jsonResponse(['error' => 'Post not found'], 404);
        }
        
        $current_tags = getTagsForPost($conn, $post_id);
        $current_tags_names = array_map(function($t) { return $t['display_name']; }, $current_tags);
        $current_tags_snapshot = json_encode($current_tags_names, JSON_UNESCAPED_UNICODE);
        $rollback_note = "回滚前保存，来源版本 #{$revision_id}";
        
        $stmt = $conn->prepare("INSERT INTO post_revisions (post_id, title, content, tags_snapshot, revision_note, created_by) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("isssss", $post_id, $current_post['title'], $current_post['content'], $current_tags_snapshot, $rollback_note, $admin_name);
        $stmt->execute();
        
        $new_title = $revision['title'];
        $new_content = $revision['content'];
        $stmt = $conn->prepare("UPDATE posts SET title = ?, content = ? WHERE id = ?");
        $stmt->bind_param("ssi", $new_title, $new_content, $post_id);
        $stmt->execute();
        
        $revision_tags = !empty($revision['tags_snapshot']) ? json_decode($revision['tags_snapshot'], true) : [];
        if (is_array($revision_tags)) {
            syncPostTags($conn, $post_id, $revision_tags);
        }
        
        $new_rev_note = "从版本 #{$revision_id} 回滚";
        $stmt = $conn->prepare("INSERT INTO post_revisions (post_id, title, content, tags_snapshot, revision_note, created_by) VALUES (?, ?, ?, ?, ?, ?)");
        $tags_snapshot = json_encode($revision_tags, JSON_UNESCAPED_UNICODE);
        $stmt->bind_param("isssss", $post_id, $new_title, $new_content, $tags_snapshot, $new_rev_note, $admin_name);
        $stmt->execute();
        
        $conn->commit();
        jsonResponse([
            'message' => 'Rollback successful',
            'post' => [
                'id' => $post_id,
                'title' => $new_title,
                'content' => $new_content,
                'tags' => $revision_tags
            ]
        ]);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => 'Rollback failed: ' . $e->getMessage()], 500);
    }
} else {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
?>
