<?php
/**
 * 帖子列表与发布接口 api/posts.php
 * 
 * 用途：
 * 1. GET: 获取帖子列表（支持分页、按标签筛选）
 * 2. POST: 发布新帖子（支持标签）
 * 
 * 核心逻辑：
 * - GET: 计算分页偏移量，查询 posts 表（关联 comments 统计评论数），返回帖子数组和分页信息。
 *        支持 ?tag=xxx 按标签筛选。
 * - POST: 接收 JSON 数据，插入新记录到 posts 表，并关联标签。
 * 
 * 异常处理：
 * - 400 Bad Request: 发帖时必填字段缺失。
 * - 500 Internal Server Error: 数据库查询或插入失败。
 */

require_once '../db.php';
require_once 'tag_functions.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $posts_per_page = 10;
    $page = isset($_GET['page']) && is_numeric($_GET['page']) ? (int)$_GET['page'] : 1;
    if ($page < 1) $page = 1;
    $offset = ($page - 1) * $posts_per_page;

    $tag_filter = isset($_GET['tag']) ? trim($_GET['tag']) : '';
    $current_tag = null;

    if (!empty($tag_filter)) {
        $normalized_tag = strtolower($tag_filter);
        $stmt = $conn->prepare("SELECT id, display_name, post_count FROM tags WHERE name = ?");
        $stmt->bind_param("s", $normalized_tag);
        $stmt->execute();
        $tagResult = $stmt->get_result();
        
        if ($tagResult->num_rows > 0) {
            $current_tag = $tagResult->fetch_assoc();
            $tag_id = $current_tag['id'];
            
            $total_stmt = $conn->prepare("SELECT COUNT(*) as count FROM post_tags pt WHERE pt.tag_id = ?");
            $total_stmt->bind_param("i", $tag_id);
            $total_stmt->execute();
            $total_row = $total_stmt->get_result()->fetch_assoc();
            $total_posts = $total_row['count'];
            
            $sql = "SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count 
                    FROM posts p 
                    INNER JOIN post_tags pt ON p.id = pt.post_id 
                    WHERE pt.tag_id = ? 
                    ORDER BY p.created_at DESC 
                    LIMIT ?, ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("iii", $tag_id, $offset, $posts_per_page);
        } else {
            $total_posts = 0;
            $sql = "SELECT p.*, 0 as comment_count FROM posts p WHERE 1 = 0";
            $stmt = $conn->prepare($sql);
        }
    } else {
        $total_result = $conn->query("SELECT COUNT(*) as count FROM posts");
        $total_row = $total_result->fetch_assoc();
        $total_posts = $total_row['count'];
        
        $sql = "SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count 
                FROM posts p 
                ORDER BY p.created_at DESC 
                LIMIT ?, ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $offset, $posts_per_page);
    }

    $total_pages = ceil($total_posts / $posts_per_page);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $posts = [];
    while($row = $result->fetch_assoc()) {
        $row['tags'] = getTagsForPost($conn, $row['id']);
        $posts[] = $row;
    }

    $response = [
        'posts' => $posts,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $total_pages,
            'total_posts' => $total_posts
        ]
    ];
    
    if ($current_tag) {
        $response['current_tag'] = $current_tag;
    }

    jsonResponse($response);
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $title = trim($input['title'] ?? '');
    $author = trim($input['author'] ?? '');
    $content = trim($input['content'] ?? '');
    $tags = isset($input['tags']) && is_array($input['tags']) ? $input['tags'] : [];

    if (empty($title) || empty($author) || empty($content)) {
        jsonResponse(['error' => 'All fields are required'], 400);
    }

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO posts (title, author_name, content) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $title, $author, $content);
        
        if (!$stmt->execute()) {
            throw new Exception('Failed to create post');
        }
        
        $post_id = $conn->insert_id;
        
        if (!empty($tags)) {
            syncPostTags($conn, $post_id, $tags);
        }
        
        $conn->commit();
        
        $post_tags = getTagsForPost($conn, $post_id);
        
        jsonResponse([
            'message' => 'Post created', 
            'id' => $post_id,
            'tags' => $post_tags
        ], 201);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}
?>