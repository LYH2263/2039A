<?php
/**
 * 后台举报管理接口 api/admin/reports.php
 * 
 * 用途：
 * 管理员查看举报列表、处理举报（忽略或删除被举报内容）。
 * 
 * 核心逻辑：
 * 1. 鉴权：check_admin_auth()
 * 2. GET: 按状态获取举报列表（pending/handled），同一内容的多个举报聚合展示
 * 3. PUT: 处理举报（忽略 或 删除被举报内容），同时处理所有同目标的举报
 * 
 * 异常处理：
 * - 401 Unauthorized: 未登录
 * - 400 Bad Request: 参数缺失
 * - 404 Not Found: 举报不存在
 */

require_once '../../db.php';
require_once '../tag_functions.php';
check_admin_auth();

$conn = get_db_connection();
$admin_user = ADMIN_USER;

ensure_reports_table_exists($conn);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $status_filter = isset($_GET['status']) ? $_GET['status'] : 'pending';
    $valid_statuses = ['pending', 'handled'];
    if (!in_array($status_filter, $valid_statuses)) {
        $status_filter = 'pending';
    }

    if ($status_filter === 'pending') {
        $status_where = "status = 'pending'";
    } else {
        $status_where = "status IN ('ignored', 'deleted')";
    }

    $sql = "SELECT 
        id, target_type, target_id, post_id, reporter_name, reason, remark,
        status, target_snapshot, target_author, handled_at, handled_by, created_at
    FROM reports
    WHERE {$status_where}
    ORDER BY created_at DESC";

    $result = $conn->query($sql);
    $all_reports = [];
    while ($row = $result->fetch_assoc()) {
        $all_reports[] = $row;
    }

    $target_info = [];
    foreach ($all_reports as $r) {
        $tt = $r['target_type'];
        $tid = (int)$r['target_id'];
        $key = $tt . '_' . $tid;
        if (!isset($target_info[$key])) {
            if ($tt === 'post') {
                $stmt = $conn->prepare("SELECT title FROM posts WHERE id = ?");
                $stmt->bind_param("i", $tid);
                $stmt->execute();
                $p_result = $stmt->get_result();
                $target_info[$key] = [
                    'post_title' => $p_result->num_rows > 0 ? $p_result->fetch_assoc()['title'] : null,
                    'comment_post_id' => null
                ];
                $stmt->close();
            } else {
                $stmt = $conn->prepare("SELECT post_id FROM comments WHERE id = ?");
                $stmt->bind_param("i", $tid);
                $stmt->execute();
                $c_result = $stmt->get_result();
                $comment_post_id = $c_result->num_rows > 0 ? (int)$c_result->fetch_assoc()['post_id'] : null;
                $stmt->close();

                $post_title = null;
                if ($comment_post_id !== null) {
                    $stmt2 = $conn->prepare("SELECT title FROM posts WHERE id = ?");
                    $stmt2->bind_param("i", $comment_post_id);
                    $stmt2->execute();
                    $p_result = $stmt2->get_result();
                    if ($p_result->num_rows > 0) {
                        $post_title = $p_result->fetch_assoc()['title'];
                    }
                    $stmt2->close();
                }
                $target_info[$key] = [
                    'post_title' => $post_title,
                    'comment_post_id' => $comment_post_id
                ];
            }
        }
    }

    $agg_counts = [];
    $agg_reasons = [];
    $count_sql = "SELECT target_type, target_id, COUNT(*) as cnt, 
                  GROUP_CONCAT(DISTINCT reason SEPARATOR '|') as reasons
                  FROM reports WHERE status = 'pending' 
                  GROUP BY target_type, target_id";
    $count_result = $conn->query($count_sql);
    while ($row = $count_result->fetch_assoc()) {
        $key = $row['target_type'] . '_' . $row['target_id'];
        $agg_counts[$key] = (int)$row['cnt'];
        $agg_reasons[$key] = $row['reasons'];
    }

    $seen = [];
    $reports = [];
    foreach ($all_reports as $r) {
        $key = $r['target_type'] . '_' . $r['target_id'];
        if ($status_filter === 'pending') {
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
        }

        $info = $target_info[$key] ?? ['post_title' => null, 'comment_post_id' => null];
        $reports[] = [
            'id' => (int)$r['id'],
            'target_type' => $r['target_type'],
            'target_id' => (int)$r['target_id'],
            'post_id' => (int)$r['post_id'],
            'post_title' => $info['post_title'],
            'reporter_name' => $r['reporter_name'],
            'reason' => $r['reason'],
            'remark' => $r['remark'],
            'status' => $r['status'],
            'target_snapshot' => $r['target_snapshot'],
            'target_author' => $r['target_author'],
            'handled_at' => $r['handled_at'],
            'handled_by' => $r['handled_by'],
            'created_at' => $r['created_at'],
            'same_target_pending_count' => $agg_counts[$key] ?? 0,
            'same_target_reasons' => $agg_reasons[$key] ?? null,
            'target_exists' => $r['target_type'] === 'post' ? 
                ($info['post_title'] !== null) : 
                ($info['comment_post_id'] !== null)
        ];
    }

    $stats_sql = "SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status IN ('ignored','deleted') THEN 1 ELSE 0 END) as handled_count
    FROM reports";
    $stats = $conn->query($stats_sql)->fetch_assoc();

    jsonResponse([
        'reports' => $reports,
        'stats' => [
            'pending_count' => (int)$stats['pending_count'],
            'handled_count' => (int)$stats['handled_count']
        ]
    ]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? $input['action'] : '';
    $id = isset($input['id']) ? (int)$input['id'] : 0;

    if ($id <= 0 || !in_array($action, ['ignore', 'delete_content'])) {
        jsonResponse(['error' => '参数无效'], 400);
    }

    $stmt = $conn->prepare("SELECT * FROM reports WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        jsonResponse(['error' => '举报记录不存在'], 404);
    }
    $report = $result->fetch_assoc();
    $stmt->close();

    $target_type = $report['target_type'];
    $target_id = (int)$report['target_id'];
    $new_status = $action === 'ignore' ? 'ignored' : 'deleted';

    $conn->begin_transaction();
    try {
        if ($action === 'delete_content') {
            if ($target_type === 'post') {
                $check_stmt = $conn->prepare("SELECT id FROM posts WHERE id = ?");
                $check_stmt->bind_param("i", $target_id);
                $check_stmt->execute();
                $post_exists = $check_stmt->get_result()->num_rows > 0;
                $check_stmt->close();

                if ($post_exists) {
                    $old_tag_ids = [];
                    $tag_stmt = $conn->prepare("SELECT tag_id FROM post_tags WHERE post_id = ?");
                    $tag_stmt->bind_param("i", $target_id);
                    $tag_stmt->execute();
                    $tag_result = $tag_stmt->get_result();
                    while ($row = $tag_result->fetch_assoc()) {
                        $old_tag_ids[] = $row['tag_id'];
                    }
                    $tag_stmt->close();

                    $stmt = $conn->prepare("DELETE FROM posts WHERE id = ?");
                    $stmt->bind_param("i", $target_id);
                    $stmt->execute();
                    $stmt->close();

                    foreach ($old_tag_ids as $tag_id) {
                        updateTagPostCount($conn, $tag_id);
                    }
                }
            } else {
                $check_stmt = $conn->prepare("SELECT id FROM comments WHERE id = ?");
                $check_stmt->bind_param("i", $target_id);
                $check_stmt->execute();
                $comment_exists = $check_stmt->get_result()->num_rows > 0;
                $check_stmt->close();

                if ($comment_exists) {
                    $stmt = $conn->prepare("SELECT parent_id, post_id FROM comments WHERE id = ?");
                    $stmt->bind_param("i", $target_id);
                    $stmt->execute();
                    $c_result = $stmt->get_result();
                    if ($c_result->num_rows > 0) {
                        $comment = $c_result->fetch_assoc();
                        $new_parent_id = $comment['parent_id'];
                        $stmt->close();

                        $stmt = $conn->prepare("UPDATE comments SET parent_id = ? WHERE parent_id = ?");
                        if ($new_parent_id === null) {
                            $null_val = null;
                            $stmt->bind_param("si", $null_val, $target_id);
                        } else {
                            $new_parent_id_int = (int)$new_parent_id;
                            $stmt->bind_param("ii", $new_parent_id_int, $target_id);
                        }
                        $stmt->execute();
                        $stmt->close();
                    } else {
                        $stmt->close();
                    }

                    $stmt = $conn->prepare("DELETE FROM comments WHERE id = ?");
                    $stmt->bind_param("i", $target_id);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }

        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("UPDATE reports SET status = ?, handled_at = ?, handled_by = ? 
            WHERE target_type = ? AND target_id = ?");
        $stmt->bind_param("ssssi", $new_status, $now, $admin_user, $target_type, $target_id);
        $stmt->execute();
        $stmt->close();

        $conn->commit();
        jsonResponse(['message' => $action === 'ignore' ? '已忽略举报' : '已删除被举报内容']);
    } catch (Exception $e) {
        $conn->rollback();
        jsonResponse(['error' => '操作失败: ' . $e->getMessage()], 500);
    }
}

if (!function_exists('ensure_reports_table_exists')) {
    function ensure_reports_table_exists($conn) {
        $check = $conn->query("SHOW TABLES LIKE 'reports'");
        if ($check->num_rows === 0) {
            $sql = "CREATE TABLE IF NOT EXISTS `reports` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `target_type` ENUM('post', 'comment') NOT NULL COMMENT '举报对象类型：帖子或评论',
                `target_id` INT NOT NULL COMMENT '举报对象ID',
                `post_id` INT NOT NULL COMMENT '所属帖子ID',
                `reporter_name` VARCHAR(100) NOT NULL COMMENT '举报人昵称',
                `reason` VARCHAR(50) NOT NULL COMMENT '举报理由分类',
                `remark` TEXT DEFAULT NULL COMMENT '举报人补充备注',
                `status` ENUM('pending', 'ignored', 'deleted') NOT NULL DEFAULT 'pending' COMMENT '处理状态',
                `target_snapshot` TEXT DEFAULT NULL COMMENT '举报对象内容快照',
                `target_author` VARCHAR(100) DEFAULT NULL COMMENT '举报对象作者快照',
                `handled_at` DATETIME DEFAULT NULL COMMENT '处理时间',
                `handled_by` VARCHAR(100) DEFAULT NULL COMMENT '处理人',
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
                UNIQUE KEY `unique_report` (`target_type`, `target_id`, `reporter_name`),
                INDEX `idx_status` (`status`),
                INDEX `idx_target` (`target_type`, `target_id`),
                INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            $conn->query($sql);
        }
    }
}
?>
