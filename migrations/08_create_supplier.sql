CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    website VARCHAR(255),
    supplier_name VARCHAR(255),
    manager VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    notes VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      company_id INT,
    constraint fk_company_suppliers_id foreign key (company_id) references company(id) 
);
