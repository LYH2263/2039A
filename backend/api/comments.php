<?php
/**
 * 评论接口 api/comments.php
 * 
 * 用途：
 * 1. GET: 增量拉取评论列表（支持 since_id 避免重复）
 * 2. POST: 处理用户提交的新评论
 * 
 * 核心逻辑：
 * - GET: 接收 post_id 和可选的 since_id，返回 ID > since_id 的新评论
 * - POST: 接收 JSON 数据，验证后插入 comments 表
 * 
 * 异常处理：
 * - 400 Bad Request: 必填字段缺失或 post_id 无效
 * - 500 Internal Server Error: 数据库操作失败
 */

require_once '../db.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $post_id = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
    $since_id = isset($_GET['since_id']) ? (int)$_GET['since_id'] : 0;

    if ($post_id <= 0) {
        jsonResponse(['error' => 'Invalid post_id'], 400);
    }

    if ($since_id > 0) {
        $stmt = $conn->prepare("SELECT * FROM comments WHERE post_id = ? AND id > ? ORDER BY created_at ASC");
        $stmt->bind_param("ii", $post_id, $since_id);
    } else {
        $stmt = $conn->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC");
        $stmt->bind_param("i", $post_id);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $comments = [];
    $max_id = $since_id;
    while ($row = $result->fetch_assoc()) {
        $comments[] = $row;
        if ((int)$row['id'] > $max_id) {
            $max_id = (int)$row['id'];
        }
    }

    jsonResponse([
        'comments' => $comments,
        'max_id' => $max_id,
        'total' => count($comments)
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $post_id = isset($input['post_id']) ? (int)$input['post_id'] : 0;
    $nickname = trim($input['nickname'] ?? '');
    $content = trim($input['content'] ?? '');

    // 异常处理：表单空提交或字段缺失（后端校验）
    if ($post_id <= 0 || empty($nickname) || empty($content)) {
        jsonResponse(['error' => 'Invalid input'], 400);
    }

    // 核心逻辑：插入评论
    $stmt = $conn->prepare("INSERT INTO comments (post_id, author_name, content) VALUES (?, ?, ?)");
    $stmt->bind_param("iss", $post_id, $nickname, $content);
    
    if ($stmt->execute()) {
        $new_id = (int)$conn->insert_id;
        $stmt2 = $conn->prepare("SELECT * FROM comments WHERE id = ?");
        $stmt2->bind_param("i", $new_id);
        $stmt2->execute();
        $new_comment = $stmt2->get_result()->fetch_assoc();
        jsonResponse(['message' => 'Comment created', 'comment' => $new_comment], 201);
    } else {
        // 异常处理：插入失败
        jsonResponse(['error' => 'Failed to create comment'], 500);
    }
}
?>