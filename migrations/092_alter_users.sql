ALTER TABLE users 
ADD COLUMN telegram_id BIGINT NULL,
ADD COLUMN telegram_conf_code INT NULL,
ADD COLUMN telegram_conf_expires_at TIMESTAMP NULL;
