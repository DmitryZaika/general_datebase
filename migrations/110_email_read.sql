CREATE TABLE email_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_id INT NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(500),
    ip_address VARCHAR(100),
    FOREIGN KEY (email_id) REFERENCES emails(id)
);
