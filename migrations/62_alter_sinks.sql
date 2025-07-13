ALTER TABLE sinks
ADD COLUMN slab_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_sinkslab FOREIGN KEY (slab_id) REFERENCES slab_inventory(id);
