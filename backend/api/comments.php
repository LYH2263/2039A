<?php
/**
 * 评论接口 api/comments.php
 * 
 * 用途：
 * 1. GET: 增量拉取评论列表（支持 since_id 避免重复）
 * 2. GET: view=tree 返回层级化的评论树结构（用于思维导图视图）
 * 3. POST: 处理用户提交的新评论（支持 parent_id 进行楼中楼回复）
 * 
 * 核心逻辑：
 * - GET (list): 接收 post_id 和可选的 since_id，返回 ID > since_id 的新评论
 * - GET (tree): 接收 post_id，返回树形结构的评论数据
 * - POST: 接收 JSON 数据，验证后插入 comments 表（支持 parent_id）
 * 
 * 异常处理：
 * - 400 Bad Request: 必填字段缺失或 post_id 无效
 * - 500 Internal Server Error: 数据库操作失败
 */

require_once '../db.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $post_id = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
    $view = isset($_GET['view']) ? $_GET['view'] : 'list';

    if ($post_id <= 0) {
        jsonResponse(['error' => 'Invalid post_id'], 400);
    }

    if ($view === 'tree') {
        $stmt = $conn->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC");
        $stmt->bind_param("i", $post_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $comments = [];
        while ($row = $result->fetch_assoc()) {
            $comments[] = [
                'id' => (int)$row['id'],
                'post_id' => (int)$row['post_id'],
                'parent_id' => $row['parent_id'] ? (int)$row['parent_id'] : null,
                'author_name' => $row['author_name'],
                'content' => $row['content'],
                'content_summary' => mb_substr($row['content'], 0, 50) . (mb_strlen($row['content']) > 50 ? '...' : ''),
                'created_at' => $row['created_at'],
                'children' => [],
                'descendant_count' => 0
            ];
        }

        $total = count($comments);

        $commentMap = [];
        foreach ($comments as &$comment) {
            $commentMap[$comment['id']] = &$comment;
        }

        $tree = [];
        foreach ($comments as &$comment) {
            if ($comment['parent_id'] === null) {
                $tree[] = &$comment;
            } else {
                if (isset($commentMap[$comment['parent_id']])) {
                    $commentMap[$comment['parent_id']]['children'][] = &$comment;
                } else {
                    $tree[] = &$comment;
                }
            }
        }

        function countDescendants(&$node) {
            $count = count($node['children']);
            foreach ($node['children'] as &$child) {
                $count += countDescendants($child);
            }
            $node['descendant_count'] = $count;
            return $count;
        }

        foreach ($tree as &$rootNode) {
            countDescendants($rootNode);
        }

        jsonResponse([
            'tree' => $tree,
            'total' => $total,
            'max_depth' => calculateMaxDepth($tree)
        ]);
    } else {
        $since_id = isset($_GET['since_id']) ? (int)$_GET['since_id'] : 0;

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
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $post_id = isset($input['post_id']) ? (int)$input['post_id'] : 0;
    $parent_id = isset($input['parent_id']) ? (int)$input['parent_id'] : null;
    $nickname = trim($input['nickname'] ?? '');
    $content = trim($input['content'] ?? '');

    if ($post_id <= 0 || empty($nickname) || empty($content)) {
        jsonResponse(['error' => 'Invalid input'], 400);
    }

    if ($parent_id !== null) {
        $stmt = $conn->prepare("SELECT id FROM comments WHERE id = ? AND post_id = ?");
        $stmt->bind_param("ii", $parent_id, $post_id);
        $stmt->execute();
        if ($stmt->get_result()->num_rows === 0) {
            jsonResponse(['error' => 'Invalid parent_id'], 400);
        }
    }

    if ($parent_id !== null) {
        $stmt = $conn->prepare("INSERT INTO comments (post_id, parent_id, author_name, content) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $post_id, $parent_id, $nickname, $content);
    } else {
        $stmt = $conn->prepare("INSERT INTO comments (post_id, author_name, content) VALUES (?, ?, ?)");
        $stmt->bind_param("iss", $post_id, $nickname, $content);
    }
    
    if ($stmt->execute()) {
        $new_id = (int)$conn->insert_id;
        $stmt2 = $conn->prepare("SELECT * FROM comments WHERE id = ?");
        $stmt2->bind_param("i", $new_id);
        $stmt2->execute();
        $new_comment = $stmt2->get_result()->fetch_assoc();
        jsonResponse(['message' => 'Comment created', 'comment' => $new_comment], 201);
    } else {
        jsonResponse(['error' => 'Failed to create comment'], 500);
    }
}

function calculateMaxDepth($tree) {
    $maxDepth = 0;
    foreach ($tree as $node) {
        $depth = getNodeDepth($node, 1);
        if ($depth > $maxDepth) {
            $maxDepth = $depth;
        }
    }
    return $maxDepth;
}

function getNodeDepth($node, $currentDepth) {
    if (empty($node['children'])) {
        return $currentDepth;
    }
    $maxChildDepth = $currentDepth;
    foreach ($node['children'] as $child) {
        $childDepth = getNodeDepth($child, $currentDepth + 1);
        if ($childDepth > $maxChildDepth) {
            $maxChildDepth = $childDepth;
        }
    }
    return $maxChildDepth;
}
?>