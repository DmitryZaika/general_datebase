
UPDATE deals_list SET position = position + 1 WHERE deleted_at IS NULL AND position >= 3;

INSERT INTO deals_list (name, position) VALUES ('On Hold', 3);


