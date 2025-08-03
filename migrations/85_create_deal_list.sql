INSERT INTO deals_list (id, name, position, user_id)
VALUES (1, 'New Customers', 0, NULL)
ON DUPLICATE KEY UPDATE name = name;