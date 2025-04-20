ALTER TABLE slab_inventory 
ADD COLUMN sale_id INT NULL,
ADD COLUMN price DECIMAL(10, 2),
ADD COLUMN notes TEXT,
ADD COLUMN is_cut BOOLEAN DEFAULT FALSE,
ADD COLUMN parent_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_sale_slab_junction_2
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_parent_slab_junction
    FOREIGN KEY (parent_id) REFERENCES slab_inventory(id) ON DELETE CASCADE; 