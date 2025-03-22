import { StoneFilter } from "~/schemas/stones";
import { STONE_TYPES } from "~/utils/constants";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";

export interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: number;
  height: number | null;
  width: number | null;
  amount: number;
  available: number;
  created_date: string;
  on_sale: boolean;
}

export const stoneQueryBuilder = async (
  filters: StoneFilter,
  companyId: number,
): Promise<Stone[]> => {
  if (filters.type.length === 0) {
    return [];
  }
  const params: (string | number)[] = [companyId];
  let query = `
  SELECT 
    s.id, 
    s.name, 
    s.type, 
    s.url, 
    s.is_display, 
    s.height, 
    s.width,
    s.created_date, 
    s.on_sale,
    COUNT(si.stone_id) AS amount,
    SUM(CASE WHEN si.is_sold = 0 THEN 1 ELSE 0 END) AS available
  FROM main.stones s
  LEFT JOIN main.slab_inventory AS si ON si.stone_id = s.id
  WHERE s.company_id = ? AND s.is_display = 1
  `;
  if (filters.type.length < STONE_TYPES.length) {
    query += ` AND s.type IN (${filters.type.map(() => "?").join(", ")})`;
    params.push(...filters.type);
  }
  if (filters.supplier > 0) {
    query += " AND s.supplier_id = ?";
    params.push(filters.supplier);
  }
  query += `
    GROUP BY
      s.id,
      s.name,
      s.type,
      s.url,
      s.is_display,
      s.height,
      s.width,
      s.created_date,
      s.on_sale
    `;
  if (!filters.show_sold_out) {
    query += `\nHAVING available > 0`;
  }
  query += `\nORDER BY s.name ASC`;
  return await selectMany<Stone>(db, query, params);
};
