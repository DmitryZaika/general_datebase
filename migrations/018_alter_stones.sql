ALTER TABLE stones
ADD COLUMN supplier_id INT,
ADD CONSTRAINT fk_stones_supplier
FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
