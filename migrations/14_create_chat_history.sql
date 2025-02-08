CREATE TABLE chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    history JSON NOT NULL,      
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    CONSTRAINT fk_user_chat_history
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);