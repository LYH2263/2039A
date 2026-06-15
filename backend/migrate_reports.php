<?php
require_once __DIR__ . '/db.php';

$conn = get_db_connection();

$sql = "CREATE TABLE IF NOT EXISTS `reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `target_type` ENUM('post', 'comment') NOT NULL COMMENT '举报对象类型：帖子或评论',
    `target_id` INT NOT NULL COMMENT '举报对象ID',
    `post_id` INT NOT NULL COMMENT '所属帖子ID（评论举报时方便定位）',
    `reporter_name` VARCHAR(100) NOT NULL COMMENT '举报人昵称',
    `reason` VARCHAR(50) NOT NULL COMMENT '举报理由分类',
    `remark` TEXT DEFAULT NULL COMMENT '举报人补充备注',
    `status` ENUM('pending', 'ignored', 'deleted') NOT NULL DEFAULT 'pending' COMMENT '处理状态：待处理/已忽略/已删除内容',
    `target_snapshot` TEXT DEFAULT NULL COMMENT '举报对象内容快照（删除后仍可查看）',
    `target_author` VARCHAR(100) DEFAULT NULL COMMENT '举报对象作者快照',
    `handled_at` DATETIME DEFAULT NULL COMMENT '处理时间',
    `handled_by` VARCHAR(100) DEFAULT NULL COMMENT '处理人（管理员）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
    UNIQUE KEY `unique_report` (`target_type`, `target_id`, `reporter_name`),
    INDEX `idx_status` (`status`),
    INDEX `idx_target` (`target_type`, `target_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

if ($conn->query($sql)) {
    jsonResponse(['message' => 'reports table migrated successfully']);
} else {
    jsonResponse(['error' => 'Migration failed: ' . $conn->error], 500);
}
?>
