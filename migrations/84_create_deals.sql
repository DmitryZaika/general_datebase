CREATE TABLE deals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NULL,
    description TEXT NULL,
    status VARCHAR(255) NULL,
    list_id INT NOT NULL,
    position INT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (list_id) REFERENCES deals_list(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);