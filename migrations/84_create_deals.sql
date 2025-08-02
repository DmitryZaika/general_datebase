CREATE TABLE deals (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    amount DECIMAL(10, 2) NULL,
    description TEXT NULL,
    status VARCHAR(255) NULL,   
    list_id INT NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (list_id) REFERENCES deals_list(id)
);