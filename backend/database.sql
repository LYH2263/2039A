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
    `author_name` VARCHAR(100) NOT NULL COMMENT '评论昵称',
    `content` TEXT NOT NULL COMMENT '评论内容',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Insert some sample data
INSERT INTO `posts` (`title`, `content`, `author_name`, `created_at`) VALUES
('欢迎来到极简论坛', '这是一个基于 PHP + MySQL 的轻量级论坛系统。', '管理员', NOW()),
('测试帖子', '这是一条测试内容，用于验证系统功能。', '测试员', NOW());

INSERT INTO `comments` (`post_id`, `author_name`, `content`, `created_at`) VALUES
(1, '访客A', '界面很简洁，不错！', NOW()),
(1, '访客B', '加载速度很快。', NOW());
