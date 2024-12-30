CREATE TABLE images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    url VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      company_id INT,
    constraint fk_company_images_id foreign key (company_id) references company(id) 
);