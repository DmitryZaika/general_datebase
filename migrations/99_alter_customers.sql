UPDATE deals d
JOIN deals_list dl ON dl.id = d.list_id AND dl.deleted_at IS NULL
SET d.status = dl.name
WHERE d.deleted_at IS NULL;