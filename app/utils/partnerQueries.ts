export function getPartnersForUser(userId: number): string {
  return `
    SELECT
      c.id as partner_id,
      c.company_name,
      c.name as contact_name,
      c.phone,
      c.email
    FROM customers c
    WHERE
      c.company_name IS NOT NULL
      AND c.company_name != ''
      AND c.deleted_at IS NULL
      AND c.company_id = (SELECT company_id FROM users WHERE id = ?)
    ORDER BY c.company_name ASC
  `
}
