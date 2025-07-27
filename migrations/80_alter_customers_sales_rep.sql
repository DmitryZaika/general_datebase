ALTER TABLE customers
ADD COLUMN sales_rep INT;

ALTER TABLE customers
ADD CONSTRAINT fk_customers_sales_rep
FOREIGN KEY (sales_rep) REFERENCES users(id); 