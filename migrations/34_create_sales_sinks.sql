CREATE TABLE sink_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    retail_price DECIMAL(10, 2),
    cost DECIMAL(10, 2),
    is_display BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    length INT NOT NULL,
    width INT NOT NULL,
    depth INT NOT NULL,
    supplier_id INT,
    company_id INT NOT NULL,
    CONSTRAINT fk_supplier_junction
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_company_junction
        FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
); 