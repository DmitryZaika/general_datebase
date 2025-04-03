CREATE TABLE stone_colors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    stone_id INT NOT NULL,
    CONSTRAINT fk_stone_colors_stone_id FOREIGN KEY (stone_id) REFERENCES stones(id) ON DELETE CASCADE
);