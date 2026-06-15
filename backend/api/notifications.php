<?php
/**
 * 通知接口 api/notifications.php
 * 
 * 用途：
 * 1. GET: 获取通知列表（按作者昵称，带分页）
 * 2. GET: action=unread_count 获取未读通知数量
 * 3. POST: action=read 标记单条通知为已读
 * 4. POST: action=read_all 标记全部通知为已读
 * 
 * 核心逻辑：
 * - 以 recipient_name（作者昵称）作为通知归属维度
 * - 列表接口返回最近通知，支持 limit 参数
 * - 已读操作幂等：重复标记已读不会报错
 * - 帖子被删除后仍可通过 post_title 快照展示通知
 */

require_once '../db.php';

$conn = get_db_connection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : 'list';
    $recipient = isset($_GET['recipient']) ? trim($_GET['recipient']) : '';

    if (empty($recipient)) {
        jsonResponse(['error' => 'recipient is required'], 400);
    }

    if ($action === 'unread_count') {
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM notifications WHERE recipient_name = ? AND is_read = 0");
        $stmt->bind_param("s", $recipient);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        jsonResponse([
            'unread_count' => (int)$row['count']
        ]);
    } else {
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        if ($limit <= 0 || $limit > 100) $limit = 20;
        if ($offset < 0) $offset = 0;

        $stmt = $conn->prepare("SELECT * FROM notifications WHERE recipient_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->bind_param("sii", $recipient, $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();

        $notifications = [];
        while ($row = $result->fetch_assoc()) {
            $notifications[] = [
                'id' => (int)$row['id'],
                'type' => $row['type'],
                'post_id' => (int)$row['post_id'],
                'post_title' => $row['post_title'],
                'comment_id' => $row['comment_id'] ? (int)$row['comment_id'] : null,
                'comment_author' => $row['comment_author'],
                'comment_content' => $row['comment_content'],
                'is_read' => (bool)$row['is_read'],
                'created_at' => $row['created_at'],
                'read_at' => $row['read_at']
            ];
        }

        $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM notifications WHERE recipient_name = ?");
        $countStmt->bind_param("s", $recipient);
        $countStmt->execute();
        $countResult = $countStmt->get_result();
        $totalRow = $countResult->fetch_assoc();

        $unreadStmt = $conn->prepare("SELECT COUNT(*) as unread FROM notifications WHERE recipient_name = ? AND is_read = 0");
        $unreadStmt->bind_param("s", $recipient);
        $unreadStmt->execute();
        $unreadResult = $unreadStmt->get_result();
        $unreadRow = $unreadResult->fetch_assoc();

        jsonResponse([
            'notifications' => $notifications,
            'total' => (int)$totalRow['total'],
            'unread_count' => (int)$unreadRow['unread'],
            'limit' => $limit,
            'offset' => $offset
        ]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? $input['action'] : '';
    $recipient = isset($input['recipient']) ? trim($input['recipient']) : '';

    if (empty($recipient)) {
        jsonResponse(['error' => 'recipient is required'], 400);
    }

    if ($action === 'read') {
        $id = isset($input['id']) ? (int)$input['id'] : 0;
        if ($id <= 0) {
            jsonResponse(['error' => 'Invalid notification id'], 400);
        }

        $stmt = $conn->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND recipient_name = ? AND is_read = 0");
        $stmt->bind_param("is", $id, $recipient);
        $stmt->execute();

        $unreadStmt = $conn->prepare("SELECT COUNT(*) as unread FROM notifications WHERE recipient_name = ? AND is_read = 0");
        $unreadStmt->bind_param("s", $recipient);
        $unreadStmt->execute();
        $unreadResult = $unreadStmt->get_result();
        $unreadRow = $unreadResult->fetch_assoc();

        jsonResponse([
            'success' => true,
            'updated' => $stmt->affected_rows > 0,
            'unread_count' => (int)$unreadRow['unread']
        ]);
    } elseif ($action === 'read_all') {
        $stmt = $conn->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE recipient_name = ? AND is_read = 0");
        $stmt->bind_param("s", $recipient);
        $stmt->execute();

        jsonResponse([
            'success' => true,
            'updated_count' => $stmt->affected_rows
        ]);
    } else {
        jsonResponse(['error' => 'Invalid action'], 400);
    }
}
?>
