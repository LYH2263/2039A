<?php
/**
 * 标签接口 api/tags.php
 * 
 * 用途：
 * 1. GET: 获取标签列表（支持搜索、分页、按帖子数排序）
 * 2. GET /?tag=xxx: 按标签名称查询帖子列表
 * 3. GET /?id=xxx: 获取单个标签详情
 * 4. POST: 创建新标签（或批量获取/创建标签）
 * 5. PUT: 更新标签名称
 * 6. DELETE: 删除标签
 * 
 * 核心逻辑：
 * - 标签名称 trim + 大小写归一化（转小写）作为唯一键
 * - display_name 保留用户输入的原始大小写
 * - post_count 统计使用该标签的帖子数量
 * 
 * 异常处理：
 * - 400 Bad Request: 参数缺失或非法
 * - 404 Not Found: 标签不存在
 * - 409 Conflict: 标签名称已存在
 */

require_once '../db.php';
require_once 'tag_functions.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['post_id']) && is_numeric($_GET['post_id'])) {
        $post_id = (int)$_GET['post_id'];
        $tags = getTagsForPost($conn, $post_id);
        jsonResponse(['tags' => $tags]);
    }
    
    if (isset($_GET['tag']) && !empty($_GET['tag'])) {
        $tagName = normalizeTagName($_GET['tag']);
        $posts_per_page = 10;
        $page = isset($_GET['page']) && is_numeric($_GET['page']) ? (int)$_GET['page'] : 1;
        if ($page < 1) $page = 1;
        $offset = ($page - 1) * $posts_per_page;
        
        $stmt = $conn->prepare("SELECT id, display_name, post_count FROM tags WHERE name = ?");
        $stmt->bind_param("s", $tagName);
        $stmt->execute();
        $tagResult = $stmt->get_result();
        
        if ($tagResult->num_rows === 0) {
            jsonResponse([
                'tag' => null,
                'posts' => [],
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => 0,
                    'total_posts' => 0
                ]
            ]);
        }
        
        $tag = $tagResult->fetch_assoc();
        $tag_id = $tag['id'];
        
        $total_stmt = $conn->prepare("SELECT COUNT(*) as count FROM post_tags pt WHERE pt.tag_id = ?");
        $total_stmt->bind_param("i", $tag_id);
        $total_stmt->execute();
        $total_row = $total_stmt->get_result()->fetch_assoc();
        $total_posts = $total_row['count'];
        $total_pages = ceil($total_posts / $posts_per_page);
        
        $sql = "SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count 
                FROM posts p 
                INNER JOIN post_tags pt ON p.id = pt.post_id 
                WHERE pt.tag_id = ? 
                ORDER BY p.created_at DESC 
                LIMIT ?, ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("iii", $tag_id, $offset, $posts_per_page);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $posts = [];
        while($row = $result->fetch_assoc()) {
            $posts[] = $row;
        }
        
        foreach ($posts as &$post) {
            $post['tags'] = getTagsForPost($conn, $post['id']);
        }
        
        jsonResponse([
            'tag' => $tag,
            'posts' => $posts,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $total_pages,
                'total_posts' => $total_posts
            ]
        ]);
    }
    
    if (isset($_GET['id']) && is_numeric($_GET['id'])) {
        $tag_id = (int)$_GET['id'];
        $stmt = $conn->prepare("SELECT * FROM tags WHERE id = ?");
        $stmt->bind_param("i", $tag_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            jsonResponse(['error' => 'Tag not found'], 404);
        }
        
        $tag = $result->fetch_assoc();
        jsonResponse(['tag' => $tag]);
    }
    
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $sort = isset($_GET['sort']) && $_GET['sort'] === 'name' ? 'name' : 'post_count';
    $order = isset($_GET['order']) && $_GET['order'] === 'asc' ? 'ASC' : 'DESC';
    $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? (int)$_GET['limit'] : 0;
    
    $sql = "SELECT * FROM tags";
    $params = [];
    $types = '';
    
    if (!empty($search)) {
        $sql .= " WHERE name LIKE ? OR display_name LIKE ?";
        $search_term = "%$search%";
        $params[] = $search_term;
        $params[] = $search_term;
        $types .= 'ss';
    }
    
    $sql .= " ORDER BY $sort $order";
    
    if ($limit > 0) {
        $sql .= " LIMIT ?";
        $params[] = $limit;
        $types .= 'i';
    }
    
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $tags = [];
    while($row = $result->fetch_assoc()) {
        $tags[] = $row;
    }
    
    jsonResponse(['tags' => $tags]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['batch']) && is_array($input['batch'])) {
        $tagNames = $input['batch'];
        $conn->begin_transaction();
        try {
            $tags = [];
            $seen = [];
            
            foreach ($tagNames as $name) {
                $trimmed = trim($name);
                if (empty($trimmed)) continue;
                
                $normalized = normalizeTagName($trimmed);
                if (in_array($normalized, $seen)) continue;
                $seen[] = $normalized;
                
                $stmt = $conn->prepare("SELECT * FROM tags WHERE name = ?");
                $stmt->bind_param("s", $normalized);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows > 0) {
                    $tags[] = $result->fetch_assoc();
                } else {
                    $stmt = $conn->prepare("INSERT INTO tags (name, display_name) VALUES (?, ?)");
                    $stmt->bind_param("ss", $normalized, $trimmed);
                    $stmt->execute();
                    $new_id = $conn->insert_id;
                    
                    $stmt = $conn->prepare("SELECT * FROM tags WHERE id = ?");
                    $stmt->bind_param("i", $new_id);
                    $stmt->execute();
                    $new_tag = $stmt->get_result()->fetch_assoc();
                    $tags[] = $new_tag;
                }
            }
            
            $conn->commit();
            jsonResponse(['tags' => $tags]);
        } catch (Exception $e) {
            $conn->rollback();
            jsonResponse(['error' => 'Failed to process tags: ' . $e->getMessage()], 500);
        }
    }
    
    $name = trim($input['name'] ?? '');
    
    if (empty($name)) {
        jsonResponse(['error' => 'Tag name is required'], 400);
    }
    
    if (mb_strlen($name) > 50) {
        jsonResponse(['error' => 'Tag name must be less than 50 characters'], 400);
    }
    
    $normalized = normalizeTagName($name);
    
    $stmt = $conn->prepare("SELECT id FROM tags WHERE name = ?");
    $stmt->bind_param("s", $normalized);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        jsonResponse(['error' => 'Tag already exists'], 409);
    }
    
    $stmt = $conn->prepare("INSERT INTO tags (name, display_name) VALUES (?, ?)");
    $stmt->bind_param("ss", $normalized, $name);
    
    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        $stmt = $conn->prepare("SELECT * FROM tags WHERE id = ?");
        $stmt->bind_param("i", $new_id);
        $stmt->execute();
        $tag = $stmt->get_result()->fetch_assoc();
        jsonResponse(['message' => 'Tag created', 'tag' => $tag], 201);
    } else {
        jsonResponse(['error' => 'Failed to create tag'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        jsonResponse(['error' => 'Valid tag ID is required'], 400);
    }
    
    $tag_id = (int)$_GET['id'];
    $new_name = trim($input['name'] ?? '');
    
    if (empty($new_name)) {
        jsonResponse(['error' => 'Tag name is required'], 400);
    }
    
    if (mb_strlen($new_name) > 50) {
        jsonResponse(['error' => 'Tag name must be less than 50 characters'], 400);
    }
    
    $normalized = normalizeTagName($new_name);
    
    $stmt = $conn->prepare("SELECT id FROM tags WHERE id = ?");
    $stmt->bind_param("i", $tag_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        jsonResponse(['error' => 'Tag not found'], 404);
    }
    
    $stmt = $conn->prepare("SELECT id FROM tags WHERE name = ? AND id != ?");
    $stmt->bind_param("si", $normalized, $tag_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        jsonResponse(['error' => 'Tag name already exists'], 409);
    }
    
    $stmt = $conn->prepare("UPDATE tags SET name = ?, display_name = ? WHERE id = ?");
    $stmt->bind_param("ssi", $normalized, $new_name, $tag_id);
    
    if ($stmt->execute()) {
        $stmt = $conn->prepare("SELECT * FROM tags WHERE id = ?");
        $stmt->bind_param("i", $tag_id);
        $stmt->execute();
        $tag = $stmt->get_result()->fetch_assoc();
        jsonResponse(['message' => 'Tag updated', 'tag' => $tag]);
    } else {
        jsonResponse(['error' => 'Failed to update tag'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        jsonResponse(['error' => 'Valid tag ID is required'], 400);
    }
    
    $tag_id = (int)$_GET['id'];
    
    $stmt = $conn->prepare("SELECT id FROM tags WHERE id = ?");
    $stmt->bind_param("i", $tag_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        jsonResponse(['error' => 'Tag not found'], 404);
    }
    
    $conn->begin_transaction();
    try {
        $conn->query("DELETE FROM post_tags WHERE tag_id = $tag_id");
        $conn->query("DELETE FROM tags WHERE id = $tag_id");
        $conn->commit();
        jsonResponse(['message' => 'Tag deleted successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => 'Failed to delete tag: ' . $e->getMessage()], 500);
    }
}
?>
