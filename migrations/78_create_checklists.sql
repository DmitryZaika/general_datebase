CREATE TABLE checklists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL,
    installer_id INT NULL,
    customer_name VARCHAR(255) NOT NULL,
    installation_address VARCHAR(255) NOT NULL,
    material_correct BOOLEAN NOT NULL DEFAULT FALSE,
    seams_satisfaction BOOLEAN NOT NULL DEFAULT FALSE,
    appliances_fit BOOLEAN NOT NULL DEFAULT FALSE,
    backsplashes_correct BOOLEAN NOT NULL DEFAULT FALSE,
    edges_correct BOOLEAN NOT NULL DEFAULT FALSE,
    holes_drilled BOOLEAN NOT NULL DEFAULT FALSE,
    cleanup_completed BOOLEAN NOT NULL DEFAULT FALSE,
    comments TEXT NULL,
    signature TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_checklists_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_checklists_installer FOREIGN KEY (installer_id) REFERENCES users(id) ON DELETE SET NULL
); 