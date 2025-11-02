CREATE TABLE quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    quote_name VARCHAR(255) NULL,
    quote_type VARCHAR(255) NOT NULL,
    created_date DATETIME NOT NULL,
    sales_rep VARCHAR(255) NOT NULL,
    company_id INT NOT NULL,
    deleted_at DATETIME NULL,
    FOREIGN KEY (company_id) REFERENCES company(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);


