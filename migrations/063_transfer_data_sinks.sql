UPDATE sinks
SET slab_id = (
    SELECT slab_inventory.id 
    FROM slab_inventory
    WHERE slab_inventory.sale_id = sinks.sale_id
    LIMIT 1
)
WHERE sinks.sale_id IS NOT NULL;
