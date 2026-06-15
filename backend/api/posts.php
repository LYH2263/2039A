<?php
/**
 * 帖子列表与发布接口 api/posts.php
 * 
 * 用途：
 * 1. GET: 获取帖子列表（支持分页）
 * 2. POST: 发布新帖子
 * 
 * 核心逻辑：
 * - GET: 计算分页偏移量，查询 posts 表（关联 comments 统计评论数），返回帖子数组和分页信息。
 * - POST: 接收 JSON 数据，插入新记录到 posts 表。
 * 
 * 异常处理：
 * - 400 Bad Request: 发帖时必填字段缺失。
 * - 500 Internal Server Error: 数据库查询或插入失败。
 */

require_once '../db.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // 核心逻辑：处理分页参数
    $posts_per_page = 10;
    $page = isset($_GET['page']) && is_numeric($_GET['page']) ? (int)$_GET['page'] : 1;
    if ($page < 1) $page = 1;
    $offset = ($page - 1) * $posts_per_page;

    // 核心逻辑：获取总记录数用于计算分页
    $total_result = $conn->query("SELECT COUNT(*) as count FROM posts");
    $total_row = $total_result->fetch_assoc();
    $total_posts = $total_row['count'];
    $total_pages = ceil($total_posts / $posts_per_page);

    // 核心逻辑：查询当前页帖子数据（包含评论数统计子查询）
    $sql = "SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count 
            FROM posts p 
            ORDER BY p.created_at DESC 
            LIMIT ?, ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $offset, $posts_per_page);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $posts = [];
    while($row = $result->fetch_assoc()) {
        $posts[] = $row;
    }

    jsonResponse([
        'posts' => $posts,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $total_pages,
            'total_posts' => $total_posts
        ]
    ]);
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create Post
    // 核心逻辑：发布帖子
    $input = json_decode(file_get_contents('php://input'), true);
    $title = trim($input['title'] ?? '');
    $author = trim($input['author'] ?? '');
    $content = trim($input['content'] ?? '');

    // 异常处理：表单空提交或字段缺失（后端校验）
    if (empty($title) || empty($author) || empty($content)) {
        jsonResponse(['error' => 'All fields are required'], 400);
    }

    $stmt = $conn->prepare("INSERT INTO posts (title, author_name, content) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $title, $author, $content);
    
    if ($stmt->execute()) {
        jsonResponse(['message' => 'Post created', 'id' => $conn->insert_id], 201);
    } else {
        // 异常处理：插入失败
        jsonResponse(['error' => 'Failed to create post'], 500);
    }
}
?>