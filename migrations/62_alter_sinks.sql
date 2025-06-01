ALTER TABLE main.sinks
ADD COLUMN slab_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_sinkslab FOREIGN KEY (slab_id) REFERENCES main.slab_inventory(id);
