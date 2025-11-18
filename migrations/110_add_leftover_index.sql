CREATE INDEX idx_slab_inventory_leftover
ON slab_inventory(stone_id, is_leftover, sale_id);
