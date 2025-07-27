CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100),
    name VARCHAR(100),
    phone_number VARCHAR(100),
    is_employee BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    is_superuser BOOLEAN DEFAULT false,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      company_id INT,
    constraint fk_company_users_id foreign key (company_id) references company(id) 
);