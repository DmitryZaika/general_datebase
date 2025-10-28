CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    color VARCHAR(50) DEFAULT 'primary',
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_user_id INT NOT NULL,
    assigned_user_id INT DEFAULT NULL,
    sale_id INT DEFAULT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_date TIMESTAMP DEFAULT NULL,
    
    CONSTRAINT fk_events_created_user
        FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_events_assigned_user
        FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_events_sale
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
); 