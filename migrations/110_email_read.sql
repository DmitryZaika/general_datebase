CREATE TABLE email_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(36) NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(500),
    ip_address VARCHAR(100),
    FOREIGN KEY (tracking_id) REFERENCES emails(tracking_id)
);
