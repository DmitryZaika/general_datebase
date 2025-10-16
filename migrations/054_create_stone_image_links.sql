CREATE TABLE stone_image_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stone_id INT NOT NULL,
    source_stone_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stone_id) REFERENCES stones(id) ON DELETE CASCADE,
    FOREIGN KEY (source_stone_id) REFERENCES stones(id) ON DELETE CASCADE
); 