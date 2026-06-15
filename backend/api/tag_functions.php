<?php
/**
 * 标签公共函数 tag_functions.php
 * 
 * 用途：提供标签相关的公共函数，供其他接口复用。
 */

function normalizeTagName($name) {
    return strtolower(trim($name));
}

function getTagsForPost($conn, $post_id) {
    $stmt = $conn->prepare("SELECT t.id, t.name, t.display_name, t.post_count 
                            FROM tags t 
                            INNER JOIN post_tags pt ON t.id = pt.tag_id 
                            WHERE pt.post_id = ? 
                            ORDER BY t.display_name ASC");
    $stmt->bind_param("i", $post_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $tags = [];
    while ($row = $result->fetch_assoc()) {
        $tags[] = $row;
    }
    return $tags;
}

function updateTagPostCount($conn, $tag_id) {
    $stmt = $conn->prepare("UPDATE tags SET post_count = (
        SELECT COUNT(*) FROM post_tags WHERE tag_id = ?
    ) WHERE id = ?");
    $stmt->bind_param("ii", $tag_id, $tag_id);
    $stmt->execute();
}

function syncPostTags($conn, $post_id, $tagNames) {
    $conn->begin_transaction();
    try {
        $old_tag_ids = [];
        $result = $conn->query("SELECT tag_id FROM post_tags WHERE post_id = $post_id");
        while ($row = $result->fetch_assoc()) {
            $old_tag_ids[] = $row['tag_id'];
        }
        
        $conn->query("DELETE FROM post_tags WHERE post_id = $post_id");
        
        $new_tag_ids = [];
        if (!empty($tagNames)) {
            $seen = [];
            foreach ($tagNames as $name) {
                $trimmed = trim($name);
                if (empty($trimmed)) continue;
                
                $normalized = normalizeTagName($trimmed);
                if (in_array($normalized, $seen)) continue;
                $seen[] = $normalized;
                
                $stmt = $conn->prepare("SELECT id FROM tags WHERE name = ?");
                $stmt->bind_param("s", $normalized);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows > 0) {
                    $row = $result->fetch_assoc();
                    $tag_id = $row['id'];
                } else {
                    $stmt = $conn->prepare("INSERT INTO tags (name, display_name) VALUES (?, ?)");
                    $stmt->bind_param("ss", $normalized, $trimmed);
                    $stmt->execute();
                    $tag_id = $conn->insert_id;
                }
                
                $new_tag_ids[] = $tag_id;
                
                $stmt = $conn->prepare("INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)");
                $stmt->bind_param("ii", $post_id, $tag_id);
                $stmt->execute();
            }
        }
        
        $all_tag_ids = array_unique(array_merge($old_tag_ids, $new_tag_ids));
        foreach ($all_tag_ids as $tag_id) {
            updateTagPostCount($conn, $tag_id);
        }
        
        $conn->commit();
        return true;
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}
?>
