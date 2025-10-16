INSERT INTO deals (customer_id, list_id, position, user_id)
SELECT
  c.id           AS customer_id,
  1              AS list_id,
  0              AS position,
  c.sales_rep      AS user_id
FROM customers c
WHERE c.sales_rep IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deals d
    WHERE d.customer_id = c.id
  );