<?php
/**
 * 数据库迁移脚本：为 comments 表添加 parent_id 字段
 * 
 * 用途：
 * 在已存在的数据库中添加 parent_id 字段和相关索引，支持楼中楼回复功能。
 * 如果是新安装的数据库，直接使用 database.sql 即可。
 * 
 * 使用方法：
 * 在浏览器中访问 /api/migrate_parent_id.php 或在命令行中运行 php migrate_parent_id.php
 */

require_once 'db.php';

$conn = get_db_connection();

echo "<h2>数据库迁移 - 添加评论层级支持</h2>";
echo "<pre>";

try {
    $result = $conn->query("SHOW COLUMNS FROM `comments` LIKE 'parent_id'");
    if ($result->num_rows > 0) {
        echo "[✓] parent_id 字段已存在，无需添加\n";
    } else {
        echo "[→] 正在添加 parent_id 字段...\n";
        $conn->query("ALTER TABLE `comments` ADD COLUMN `parent_id` INT DEFAULT NULL COMMENT '父评论ID，NULL表示顶级评论'");
        echo "[✓] parent_id 字段添加成功\n";
    }

    $result = $conn->query("SHOW INDEX FROM `comments` WHERE Key_name = 'idx_parent_id'");
    if ($result->num_rows > 0) {
        echo "[✓] idx_parent_id 索引已存在，无需添加\n";
    } else {
        echo "[→] 正在添加 idx_parent_id 索引...\n";
        $conn->query("ALTER TABLE `comments` ADD INDEX `idx_parent_id` (`parent_id`)");
        echo "[✓] idx_parent_id 索引添加成功\n";
    }

    $result = $conn->query("SHOW INDEX FROM `comments` WHERE Key_name = 'idx_post_id'");
    if ($result->num_rows > 0) {
        echo "[✓] idx_post_id 索引已存在，无需添加\n";
    } else {
        echo "[→] 正在添加 idx_post_id 索引...\n";
        $conn->query("ALTER TABLE `comments` ADD INDEX `idx_post_id` (`post_id`)");
        echo "[✓] idx_post_id 索引添加成功\n";
    }

    $result = $conn->query("SHOW CREATE TABLE `comments`");
    $row = $result->fetch_row();
    echo "\n[表结构]\n" . $row[1] . "\n\n";

    $result = $conn->query("SELECT COUNT(*) as total FROM `comments`");
    $row = $result->fetch_assoc();
    echo "[统计] 总评论数: " . $row['total'] . "\n";

    $result = $conn->query("SELECT COUNT(*) as replies FROM `comments` WHERE parent_id IS NOT NULL");
    $row = $result->fetch_assoc();
    echo "[统计] 楼中楼回复数: " . $row['replies'] . "\n";

    echo "\n[✓] 迁移完成！\n";

} catch (Exception $e) {
    echo "[✗] 迁移失败: " . $e->getMessage() . "\n";
    http_response_code(500);
}

echo "</pre>";
?>
