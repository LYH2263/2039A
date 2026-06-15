<?php
/**
 * 后台统计信息接口 api/admin/stats.php
 * 
 * 用途：
 * 获取后台首页所需的统计数据。
 * 
 * 核心逻辑：
 * 1. 鉴权：check_admin_auth()
 * 2. 查询 posts 表总记录数
 * 3. 查询 comments 表总记录数
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录
 */

require_once '../../db.php';
check_admin_auth();

$conn = get_db_connection();

// 核心逻辑：统计帖子和评论数量
$post_count = $conn->query("SELECT COUNT(*) as count FROM posts")->fetch_assoc()['count'];
$comment_count = $conn->query("SELECT COUNT(*) as count FROM comments")->fetch_assoc()['count'];

jsonResponse([
    'post_count' => $post_count,
    'comment_count' => $comment_count
]);
?>