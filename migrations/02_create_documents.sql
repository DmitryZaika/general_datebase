CREATE TABLE documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    src VARCHAR(255), 
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);