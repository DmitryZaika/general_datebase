CREATE TABLE faucets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sale_id INT,
    faucet_type_id INT NULL,
    price DECIMAL(10, 2),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_faucet_sale_junction
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_faucet_type_junction
        FOREIGN KEY (faucet_type_id) REFERENCES faucet_type(id) ON DELETE CASCADE
); 