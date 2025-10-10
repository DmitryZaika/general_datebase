CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    seller_id INT,
    price DECIMAL(10, 2),
    company_id INT,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_sales
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_seller_sales
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_sales
        FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
);

