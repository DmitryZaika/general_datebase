-- Create the company table
CREATE TABLE IF NOT EXISTS company (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the initial company
INSERT INTO company (name, address) VALUES ('Default Company', 'Default Address');