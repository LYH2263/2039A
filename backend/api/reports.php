<?php
/**
 * 举报接口 api/reports.php
 * 
 * 用途：
 * 处理用户提交帖子或评论的举报。
 * 
 * 核心逻辑：
 * 1. POST: 提交举报（含去重校验，快照保存被举报内容快照
 * 
 * 异常处理：
 * - 400 Bad Request: 必填字段缺失、对象不存在
 * - 409 Conflict: 同一用户重复举报同一内容
 */

require_once '../db.php';

$conn = get_db_connection();

ensure_reports_table_exists($conn);

$VALID_REASONS = [
    'spam', 'abuse', 'porn', 'violence', 'illegal', 'privacy', 'copyright', 'other'
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $target_type = isset($input['target_type']) ? trim($input['target_type']) : '';
    $target_id = isset($input['target_id']) ? (int)$input['target_id'] : 0;
    $reporter_name = isset($input['reporter_name']) ? trim($input['reporter_name']) : '';
    $reason = isset($input['reason']) ? trim($input['reason']) : '';
    $remark = isset($input['remark']) ? trim($input['remark']) : null;
    if ($remark === '') $remark = null;

    if (!in_array($target_type, ['post', 'comment'])) {
        jsonResponse(['error' => '无效的举报类型'], 400);
    }

    if ($target_id <= 0 || empty($reporter_name) || empty($reason)) {
        jsonResponse(['error' => '参数不完整'], 400);
    }

    if (!in_array($reason, $VALID_REASONS)) {
        jsonResponse(['error' => '无效的举报理由'], 400);
    }

    $target_snapshot = '';
    $target_author = '';
    $post_id = 0;

    if ($target_type === 'post') {
        $stmt = $conn->prepare("SELECT id, title, content, author_name FROM posts WHERE id = ?");
        $stmt->bind_param("i", $target_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            jsonResponse(['error' => '帖子不存在或已删除'], 404);
        }
        $post = $result->fetch_assoc();
        $post_id = $target_id;
        $target_snapshot = "标题：" . $post['title'] . "\n\n" . $post['content'];
        $target_author = $post['author_name'];
    } else {
        $stmt = $conn->prepare("SELECT c.id, c.post_id, c.content, c.author_name, p.title 
                                 FROM comments c LEFT JOIN posts p ON c.post_id = p.id WHERE c.id = ?");
        $stmt->bind_param("i", $target_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            jsonResponse(['error' => '评论不存在或已删除'], 404);
        }
        $comment = $result->fetch_assoc();
        $post_id = (int)$comment['post_id'];
        $target_snapshot = "所属帖子：" . $comment['title'] . "\n\n评论内容：" . $comment['content'];
        $target_author = $comment['author_name'];
    }

    $checkStmt = $conn->prepare("SELECT id FROM reports WHERE target_type = ? AND target_id = ? AND reporter_name = ?");
    $checkStmt->bind_param("sis", $target_type, $target_id, $reporter_name);
    $checkStmt->execute();
    if ($checkStmt->get_result()->num_rows > 0) {
        jsonResponse(['error' => '您已经举报过该内容，请勿重复举报'], 409);
    }
    $checkStmt->close();

    $stmt = $conn->prepare("INSERT INTO reports 
        (target_type, target_id, post_id, reporter_name, reason, remark, target_snapshot, target_author) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("siisssss", 
        $target_type, $target_id, $post_id, $reporter_name, $reason, $remark, $target_snapshot, $target_author
    );

    if ($stmt->execute()) {
        jsonResponse(['message' => '举报提交成功，我们会尽快处理', 'report_id' => (int)$conn->insert_id], 201);
    } else {
        jsonResponse(['error' => '举报提交失败'], 500);
    }
} else {
    jsonResponse(['error' => 'Method Not Allowed'], 405);
}

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
?>
