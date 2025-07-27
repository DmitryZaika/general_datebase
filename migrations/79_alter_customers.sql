ALTER TABLE customers
  ADD COLUMN referral_source VARCHAR(255) NULL,
  ADD COLUMN from_check_in TINYINT(1) NULL; 