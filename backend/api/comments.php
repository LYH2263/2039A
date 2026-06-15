<?php
/**
 * 评论发布接口 api/comments.php
 * 
 * 用途：
 * 处理用户提交的新评论。
 * 
 * 核心逻辑：
 * 接收 JSON 数据，验证后插入 comments 表。
 * 
 * 异常处理：
 * - 400 Bad Request: 必填字段缺失或 post_id 无效
 * - 500 Internal Server Error: 数据库插入失败
 */

require_once '../db.php';

$conn = get_db_connection();

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
        jsonResponse(['message' => 'Comment created'], 201);
    } else {
        // 异常处理：插入失败
        jsonResponse(['error' => 'Failed to create comment'], 500);
    }
}
?>