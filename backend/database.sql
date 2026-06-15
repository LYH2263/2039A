SET NAMES utf8mb4;

-- Create database (if not exists, though docker env does this)
CREATE DATABASE IF NOT EXISTS `www.17speed.vip` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `www.17speed.vip`;

-- Posts table
CREATE TABLE IF NOT EXISTS `posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL COMMENT '帖子标题',
    `content` TEXT NOT NULL COMMENT '帖子内容',
    `author_name` VARCHAR(100) NOT NULL COMMENT '作者昵称',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments table
CREATE TABLE IF NOT EXISTS `comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL COMMENT '所属帖子ID',
    `parent_id` INT DEFAULT NULL COMMENT '父评论ID，NULL表示顶级评论',
    `author_name` VARCHAR(100) NOT NULL COMMENT '评论昵称',
    `content` TEXT NOT NULL COMMENT '评论内容',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE,
    INDEX `idx_post_id` (`post_id`),
    INDEX `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `annotations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL COMMENT '所属帖子ID',
    `start_offset` INT NOT NULL COMMENT '选区起始字符偏移(相对原始正文)',
    `end_offset` INT NOT NULL COMMENT '选区结束字符偏移(相对原始正文)',
    `selected_text` TEXT NOT NULL COMMENT '被选中的原文片段(用于校验与容错)',
    `annotation_text` TEXT DEFAULT NULL COMMENT '批注内容,为空则仅高亮',
    `author_name` VARCHAR(100) NOT NULL COMMENT '批注者昵称',
    `type` ENUM('highlight', 'annotation') NOT NULL DEFAULT 'highlight' COMMENT '类型:纯高亮或带批注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tags table
CREATE TABLE IF NOT EXISTS `tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE COMMENT '标签名称(唯一，大小写归一化后)',
    `display_name` VARCHAR(50) NOT NULL COMMENT '标签显示名称(保留原始大小写)',
    `post_count` INT NOT NULL DEFAULT 0 COMMENT '使用该标签的帖子数量',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX `idx_name` (`name`),
    INDEX `idx_post_count` (`post_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post_Tags association table (many-to-many)
CREATE TABLE IF NOT EXISTS `post_tags` (
    `post_id` INT NOT NULL COMMENT '帖子ID',
    `tag_id` INT NOT NULL COMMENT '标签ID',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '关联时间',
    PRIMARY KEY (`post_id`, `tag_id`),
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
    INDEX `idx_tag_id` (`tag_id`),
    INDEX `idx_post_id` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Insert some sample data
INSERT INTO `posts` (`title`, `content`, `author_name`, `created_at`) VALUES
('欢迎来到极简论坛', '这是一个基于 PHP + MySQL 的轻量级论坛系统。', '管理员', NOW()),
('测试帖子', '这是一条测试内容，用于验证系统功能。', '测试员', NOW());

-- Insert sample tags
INSERT INTO `tags` (`name`, `display_name`, `post_count`) VALUES
('php', 'PHP', 1),
('mysql', 'MySQL', 1),
('技术', '技术', 1),
('测试', '测试', 1);

-- Associate tags with posts
INSERT INTO `post_tags` (`post_id`, `tag_id`) VALUES
(1, 1), (1, 2), (1, 3),
(2, 4);

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `recipient_name` VARCHAR(100) NOT NULL COMMENT '接收通知的作者昵称',
    `type` ENUM('comment') NOT NULL DEFAULT 'comment' COMMENT '通知类型',
    `post_id` INT NOT NULL COMMENT '关联帖子ID',
    `post_title` VARCHAR(255) DEFAULT NULL COMMENT '帖子标题快照（帖子删除后仍可展示）',
    `comment_id` INT DEFAULT NULL COMMENT '关联评论ID',
    `comment_author` VARCHAR(100) DEFAULT NULL COMMENT '评论者昵称',
    `comment_content` TEXT DEFAULT NULL COMMENT '评论内容摘要',
    `is_read` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读：0未读，1已读',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `read_at` DATETIME DEFAULT NULL COMMENT '已读时间',
    INDEX `idx_recipient_name` (`recipient_name`),
    INDEX `idx_recipient_read` (`recipient_name`, `is_read`),
    INDEX `idx_post_id` (`post_id`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `comments` (`post_id`, `parent_id`, `author_name`, `content`, `created_at`) VALUES
(1, NULL, '访客A', '界面很简洁，不错！', NOW()),
(1, NULL, '访客B', '加载速度很快。', NOW()),
(1, 1, '访客C', '同意，我也觉得界面很清爽。', NOW()),
(1, 1, '访客D', '希望能增加更多主题颜色。', NOW()),
(1, 3, '访客A', '感谢支持！我们会继续优化。', NOW()),
(1, 3, '访客E', '期待后续更新！', NOW()),
(1, 5, '管理员', '感谢您的反馈，主题功能已经在规划中。', NOW()),
(1, NULL, '新人报道', '大家好，我是新来的，请多关照！', NOW()),
(1, 8, '访客B', '欢迎欢迎！', NOW()),
(1, 8, '访客C', '你好呀！有问题可以在这里提问。', NOW()),
(1, 10, '新人报道', '好的，谢谢！请问如何修改个人头像？', NOW()),
(1, NULL, '技术爱好者', '请问这个项目是开源的吗？我想学习一下代码结构。', NOW()),
(1, 12, '管理员', '是的，项目完全开源，欢迎Star和贡献代码！', NOW());
