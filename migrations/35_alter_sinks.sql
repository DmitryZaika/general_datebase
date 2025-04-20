ALTER TABLE sinks 
ADD COLUMN sale_id INT,
ADD COLUMN sink_type_id INT NULL,
ADD COLUMN price DECIMAL(10, 2),
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
DROP COLUMN name,
DROP COLUMN url,
DROP COLUMN type,
DROP COLUMN is_display,
DROP COLUMN length,
DROP COLUMN width,
DROP COLUMN retail_price,
DROP COLUMN cost,
DROP FOREIGN KEY fk_supplier,
DROP COLUMN supplier_id,
DROP COLUMN amount,
DROP FOREIGN KEY fk_company_sinks_id,
DROP COLUMN company_id,
ADD CONSTRAINT fk_sink_sale_junction_2
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_sink_junction
        FOREIGN KEY (sink_type_id) REFERENCES sink_type(id) ON DELETE CASCADE