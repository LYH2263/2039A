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

-- Optional: Insert some sample data
INSERT INTO `posts` (`title`, `content`, `author_name`, `created_at`) VALUES
('欢迎来到极简论坛', '这是一个基于 PHP + MySQL 的轻量级论坛系统。', '管理员', NOW()),
('测试帖子', '这是一条测试内容，用于验证系统功能。', '测试员', NOW());

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
