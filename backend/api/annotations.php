<?php
require_once '../db.php';

$conn = get_db_connection();

$conn->query("CREATE TABLE IF NOT EXISTS `annotations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL,
    `start_offset` INT NOT NULL,
    `end_offset` INT NOT NULL,
    `selected_text` TEXT NOT NULL,
    `annotation_text` TEXT DEFAULT NULL,
    `author_name` VARCHAR(100) NOT NULL,
    `type` ENUM('highlight', 'annotation') NOT NULL DEFAULT 'highlight',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['post_id']) || !is_numeric($_GET['post_id'])) {
        jsonResponse(['error' => 'Invalid post_id'], 400);
    }
    $post_id = (int)$_GET['post_id'];

    $stmt = $conn->prepare("SELECT * FROM annotations WHERE post_id = ? ORDER BY start_offset ASC, created_at ASC");
    $stmt->bind_param("i", $post_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $annotations = [];
    while ($row = $result->fetch_assoc()) {
        $annotations[] = $row;
    }
    jsonResponse(['annotations' => $annotations]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $post_id = isset($input['post_id']) ? (int)$input['post_id'] : 0;
    $start_offset = isset($input['start_offset']) ? (int)$input['start_offset'] : -1;
    $end_offset = isset($input['end_offset']) ? (int)$input['end_offset'] : -1;
    $selected_text = trim($input['selected_text'] ?? '');
    $annotation_text = isset($input['annotation_text']) ? trim($input['annotation_text']) : null;
    $author_name = trim($input['author_name'] ?? '');
    $type = trim($input['type'] ?? 'highlight');

    if ($post_id <= 0 || $start_offset < 0 || $end_offset <= $start_offset || empty($selected_text) || empty($author_name)) {
        jsonResponse(['error' => 'Invalid input'], 400);
    }

    if (!in_array($type, ['highlight', 'annotation'])) {
        $type = 'highlight';
    }
    if ($type === 'annotation' && empty($annotation_text)) {
        jsonResponse(['error' => 'Annotation text is required for annotation type'], 400);
    }
    if ($type === 'highlight') {
        $annotation_text = null;
    }

    $stmt = $conn->prepare("INSERT INTO annotations (post_id, start_offset, end_offset, selected_text, annotation_text, author_name, type) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iiissss", $post_id, $start_offset, $end_offset, $selected_text, $annotation_text, $author_name, $type);

    if ($stmt->execute()) {
        $insert_id = $stmt->insert_id;
        $stmt2 = $conn->prepare("SELECT * FROM annotations WHERE id = ?");
        $stmt2->bind_param("i", $insert_id);
        $stmt2->execute();
        $annotation = $stmt2->get_result()->fetch_assoc();
        jsonResponse(['annotation' => $annotation], 201);
    } else {
        jsonResponse(['error' => 'Failed to create annotation'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;

    if ($id <= 0) {
        jsonResponse(['error' => 'Invalid annotation id'], 400);
    }

    $stmt = $conn->prepare("DELETE FROM annotations WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            jsonResponse(['message' => 'Annotation deleted']);
        } else {
            jsonResponse(['error' => 'Annotation not found'], 404);
        }
    } else {
        jsonResponse(['error' => 'Failed to delete annotation'], 500);
    }
}
