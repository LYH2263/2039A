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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $status_filter = isset($_GET['status']) ? $_GET['status'] : 'pending';
    $valid_statuses = ['pending', 'handled'];
    if (!in_array($status_filter, $valid_statuses)) {
        $status_filter = 'pending';
    }

    if ($status_filter === 'pending') {
        $status_where = "r.status = 'pending'";
    } else {
        $status_where = "r.status IN ('ignored', 'deleted')";
    }

    $sql = "SELECT 
        r.id, r.target_type, r.target_id, r.post_id, r.reporter_name, r.reason, r.remark,
        r.status, r.target_snapshot, r.target_author, r.handled_at, r.handled_by, r.created_at,
        p.title as post_title,
        c.post_id as comment_post_id,
        (SELECT COUNT(*) FROM reports r2 
         WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id 
         AND r2.status = 'pending') as same_target_pending_count,
        (SELECT GROUP_CONCAT(DISTINCT reason SEPARATOR '|') FROM reports r2 
         WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id 
         AND r2.status = 'pending') as same_target_reasons
    FROM reports r
    LEFT JOIN posts p ON r.target_type = 'post' AND r.target_id = p.id
    LEFT JOIN comments c ON r.target_type = 'comment' AND r.target_id = c.id
    WHERE {$status_where}
    GROUP BY r.target_type, r.target_id, r.id
    ORDER BY r.created_at DESC";

    $result = $conn->query($sql);
    $raw_reports = [];
    while ($row = $result->fetch_assoc()) {
        $raw_reports[] = $row;
    }

    $grouped = [];
    $seen = [];
    foreach ($raw_reports as $r) {
        $key = $r['target_type'] . '_' . $r['target_id'];
        if ($status_filter === 'pending') {
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
        }
        $grouped[] = $r;
    }

    $reports = [];
    foreach ($grouped as $r) {
        $reports[] = [
            'id' => (int)$r['id'],
            'target_type' => $r['target_type'],
            'target_id' => (int)$r['target_id'],
            'post_id' => (int)$r['post_id'],
            'post_title' => $r['post_title'],
            'reporter_name' => $r['reporter_name'],
            'reason' => $r['reason'],
            'remark' => $r['remark'],
            'status' => $r['status'],
            'target_snapshot' => $r['target_snapshot'],
            'target_author' => $r['target_author'],
            'handled_at' => $r['handled_at'],
            'handled_by' => $r['handled_by'],
            'created_at' => $r['created_at'],
            'same_target_pending_count' => (int)$r['same_target_pending_count'],
            'same_target_reasons' => $r['same_target_reasons'],
            'target_exists' => $r['target_type'] === 'post' ? 
                ($r['post_title'] !== null) : 
                ($r['comment_post_id'] !== null)
        ];
    }

    $stats_sql = "SELECT 
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
                $old_tag_ids = [];
                $tag_result = $conn->query("SELECT tag_id FROM post_tags WHERE post_id = $target_id");
                while ($row = $tag_result->fetch_assoc()) {
                    $old_tag_ids[] = $row['tag_id'];
                }

                $stmt = $conn->prepare("DELETE FROM posts WHERE id = ?");
                $stmt->bind_param("i", $target_id);
                $stmt->execute();
                $stmt->close();

                foreach ($old_tag_ids as $tag_id) {
                    updateTagPostCount($conn, $tag_id);
                }
            } else {
                $stmt = $conn->prepare("SELECT parent_id, post_id FROM comments WHERE id = ?");
                $stmt->bind_param("i", $target_id);
                $stmt->execute();
                $c_result = $stmt->get_result();
                if ($c_result->num_rows > 0) {
                    $comment = $c_result->fetch_assoc();
                    $new_parent_id = $comment['parent_id'];
                    $stmt->close();

                    $stmt = $conn->prepare("UPDATE comments SET parent_id = ? WHERE parent_id = ?");
                    $null_val = null;
                    if ($new_parent_id === null) {
                        $stmt->bind_param("ii", $null_val, $target_id);
                    } else {
                        $stmt->bind_param("ii", $new_parent_id, $target_id);
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
?>
