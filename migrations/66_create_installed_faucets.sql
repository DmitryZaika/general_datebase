CREATE TABLE installed_faucets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(255) NOT NULL,
    faucet_id INT NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_installed_faucet_junction
        FOREIGN KEY (faucet_id) REFERENCES faucet_type(id) ON DELETE CASCADE
); 