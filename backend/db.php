<?php
/**
 * 数据库连接 db.php
 * 
 * 用途：
 * 封装 MySQL 数据库连接逻辑，提供统一的连接对象获取函数。
 * 
 * 核心逻辑：
 * 1. 使用 mysqli 对象连接数据库
 * 2. 设置字符集为 utf8mb4
 * 
 * 异常处理：
 * - 数据库连接失败：捕获 connect_error，记录 error_log（不暴露给前端），并返回 500 JSON 错误。
 */

require_once __DIR__ . '/config.php';

/**
 * 获取数据库连接
 * 
 * @return mysqli 数据库连接对象
 */
function get_db_connection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    // 异常处理：数据库连接失败
    if ($conn->connect_error) {
        // 记录详细错误日志到服务器
        error_log("Connection failed: " . $conn->connect_error);
        // 返回简洁错误信息给前端，不暴露敏感信息
        jsonResponse(['error' => 'Database connection failed'], 500);
    }

    // 设置字符集，防止乱码
    $conn->set_charset("utf8mb4");
    return $conn;
}
?>