CREATE TABLE deals_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

INSERT INTO deals_list (id, name, position)
VALUES
  (1, 'New Customers', 0),
  (2, 'Contacted',     1),
  (3, 'Got a Quote',   2),
  (4, 'Closed Won',     3),
  (5, 'Closed Lost',    4);