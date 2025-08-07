ALTER TABLE customers
ADD COLUMN source VARCHAR(255) NULL AFTER referral_source;

UPDATE customers
SET source = "check-in"
WHERE from_check_in = 1;

ALTER TABLE customers
DROP COLUMN from_check_in;