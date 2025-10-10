CREATE TABLE slab_inventory (
    id SERIAL PRIMARY KEY,
    bundle VARCHAR(255),
    stone_id INT REFERENCES stones(id),
    is_sold BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);