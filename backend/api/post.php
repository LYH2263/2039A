<?php
/**
 * 帖子详情接口 api/post.php
 * 
 * 用途：
 * 获取单个帖子的详细内容及其下属评论列表。
 * 
 * 核心逻辑：
 * 1. 验证 ID 参数合法性
 * 2. 查询 posts 表获取帖子详情
 * 3. 查询 comments 表获取该帖子的所有评论
 * 
 * 异常处理：
 * - 400 Bad Request: ID 参数缺失或非数字
 * - 404 Not Found: 帖子不存在
 */

require_once '../db.php';

$conn = get_db_connection();

// 异常处理：参数校验
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    jsonResponse(['error' => 'Invalid ID'], 400);
}

$post_id = (int)$_GET['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Fetch Post
    // 核心逻辑：查询帖子详情
    $stmt = $conn->prepare("SELECT * FROM posts WHERE id = ?");
    $stmt->bind_param("i", $post_id);
    $stmt->execute();
    $post_result = $stmt->get_result();

    // 异常处理：帖子不存在
    if ($post_result->num_rows === 0) {
        jsonResponse(['error' => 'Post not found'], 404);
    }
    $post = $post_result->fetch_assoc();

    // Fetch Comments
    // 核心逻辑：查询该帖子的评论列表
    $stmt = $conn->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC");
    $stmt->bind_param("i", $post_id);
    $stmt->execute();
    $comments_result = $stmt->get_result();
    
    $comments = [];
    while($row = $comments_result->fetch_assoc()) {
        $comments[] = $row;
    }

    jsonResponse([
        'post' => $post,
        'comments' => $comments
    ]);
}
?>