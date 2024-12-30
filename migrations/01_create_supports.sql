CREATE TABLE supports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    url VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    company_id INT,
    constraint fk_company_supports_id foreign key (company_id) references company(id) 
);
