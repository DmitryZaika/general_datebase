ALTER TABLE faucets
ADD COLUMN slab_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_faucetslab FOREIGN KEY (slab_id) REFERENCES slab_inventory(id); 