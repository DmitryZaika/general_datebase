CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    edge VARCHAR(255),
    slab_id INT REFERENCES slab_inventory(id),
    sink_id INT REFERENCES sinks(id),
    backsplash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
