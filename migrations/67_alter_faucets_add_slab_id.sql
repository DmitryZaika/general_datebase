ALTER TABLE main.faucets
ADD COLUMN slab_id BIGINT UNSIGNED,
ADD CONSTRAINT fk_faucetslab FOREIGN KEY (slab_id) REFERENCES main.slab_inventory(id); 