CREATE TABLE instructions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100),
    parent_id INT,
    place INT,
    rich_text TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_parent_id FOREIGN KEY (parent_id) REFERENCES instructions(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);