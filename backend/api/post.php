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
require_once 'tag_functions.php';

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
    // 核心逻辑：查询该帖子的评论列表并组装为树形结构
    $stmt = $conn->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC");
    $stmt->bind_param("i", $post_id);
    $stmt->execute();
    $comments_result = $stmt->get_result();
    
    $flat_comments = [];
    while($row = $comments_result->fetch_assoc()) {
        $flat_comments[] = [
            'id' => (int)$row['id'],
            'post_id' => (int)$row['post_id'],
            'parent_id' => $row['parent_id'] ? (int)$row['parent_id'] : null,
            'author_name' => $row['author_name'],
            'content' => $row['content'],
            'created_at' => $row['created_at'],
            'children' => []
        ];
    }

    $comment_map = [];
    foreach ($flat_comments as &$c) {
        $comment_map[$c['id']] = &$c;
    }

    $comments_tree = [];
    foreach ($flat_comments as &$c) {
        if ($c['parent_id'] === null) {
            $comments_tree[] = &$c;
        } else if (isset($comment_map[$c['parent_id']])) {
            $comment_map[$c['parent_id']]['children'][] = &$c;
        } else {
            $comments_tree[] = &$c;
        }
    }

    $tags = getTagsForPost($conn, $post_id);

    jsonResponse([
        'post' => $post,
        'comments' => $comments_tree,
        'flat_comments' => $flat_comments,
        'total_comments' => count($flat_comments),
        'tags' => $tags
    ]);
}
?>