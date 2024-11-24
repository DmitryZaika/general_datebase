CREATE TABLE instructions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100),
    parent_id INT,
    after_id INT,
    rich_text TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_parent_id FOREIGN KEY (parent_id) REFERENCES instructions(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE

    CONSTRAINT fk_after_id FOREIGN KEY (after_id) REFERENCES instructions(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);