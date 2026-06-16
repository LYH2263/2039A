<?php
require_once '../db.php';
require_once 'tag_functions.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$page = isset($_GET['page']) && is_numeric($_GET['page']) ? (int)$_GET['page'] : 1;
if ($page < 1) $page = 1;
$posts_per_page = 10;

if ($query === '') {
    jsonResponse(['error' => '请输入搜索关键词'], 400);
}

if (mb_strlen($query) > 100) {
    jsonResponse(['error' => '搜索关键词过长，请控制在 100 个字符以内'], 400);
}

$keywords = preg_split('/\s+/', $query);
$keywords = array_filter($keywords, function($kw) {
    return $kw !== '';
});
$keywords = array_values($keywords);

if (empty($keywords)) {
    jsonResponse(['error' => '请输入有效的搜索关键词'], 400);
}

$titleWeight = 5;
$contentWeight = 1;

$scoreParts = [];
$whereParts = [];
$allParamTypes = '';
$allParams = [];

foreach ($keywords as $kw) {
    $escapedKw = str_replace(['%', '_'], ['\\%', '\\_'], $kw);
    $likeKw = '%' . $escapedKw . '%';

    $scoreParts[] = "(CASE WHEN p.title LIKE ? THEN {$titleWeight} ELSE 0 END) + (CASE WHEN p.content LIKE ? THEN {$contentWeight} ELSE 0 END)";
    $allParamTypes .= 'ss';
    $allParams[] = $likeKw;
    $allParams[] = $likeKw;

    $whereParts[] = "(p.title LIKE ? OR p.content LIKE ?)";
    $allParamTypes .= 'ss';
    $allParams[] = $likeKw;
    $allParams[] = $likeKw;
}

$scoreExpr = implode(' + ', $scoreParts);
$whereExpr = implode(' AND ', $whereParts);

$countTypes = '';
$countParams = [];
foreach ($keywords as $kw) {
    $escapedKw = str_replace(['%', '_'], ['\\%', '\\_'], $kw);
    $likeKw = '%' . $escapedKw . '%';
    $countTypes .= 'ss';
    $countParams[] = $likeKw;
    $countParams[] = $likeKw;
}

$countSql = "SELECT COUNT(*) as count FROM (
    SELECT p.id FROM posts p WHERE {$whereExpr}
) AS matched";

$countStmt = $conn->prepare($countSql);
if (!$countStmt) {
    jsonResponse(['error' => 'Database query failed'], 500);
}

$countStmt->bind_param($countTypes, ...$countParams);
$countStmt->execute();
$total_posts = $countStmt->get_result()->fetch_assoc()['count'];
$countStmt->close();

$offset = ($page - 1) * $posts_per_page;
$total_pages = max(1, ceil($total_posts / $posts_per_page));

$sql = "SELECT p.*, 
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
        ({$scoreExpr}) AS relevance
        FROM posts p
        WHERE {$whereExpr}
        ORDER BY relevance DESC, p.created_at DESC
        LIMIT ?, ?";

$allParamTypes .= 'ii';
$allParams[] = $offset;
$allParams[] = $posts_per_page;

$stmt = $conn->prepare($sql);
if (!$stmt) {
    jsonResponse(['error' => 'Database query failed'], 500);
}

$stmt->bind_param($allParamTypes, ...$allParams);
$stmt->execute();
$result = $stmt->get_result();

$posts = [];
while ($row = $result->fetch_assoc()) {
    $row['tags'] = getTagsForPost($conn, $row['id']);
    $posts[] = $row;
}
$stmt->close();

jsonResponse([
    'posts' => $posts,
    'pagination' => [
        'current_page' => $page,
        'total_pages' => $total_pages,
        'total_posts' => $total_posts
    ],
    'query' => $query,
    'keywords' => $keywords
]);
