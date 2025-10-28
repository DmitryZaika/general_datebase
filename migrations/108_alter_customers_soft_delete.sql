-- Add soft-delete column to customers
ALTER TABLE customers
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;


