import { StoneFilter } from "~/schemas/stones";
import { STONE_TYPES } from "~/utils/constants";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { SinkFilter } from "~/schemas/sinks";

export interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: number;
  length: number | null;
  width: number | null;
  amount: number;
  available: number;
  created_date: string;
  on_sale: boolean;
  retail_price: number;
  cost_per_sqft: number;
}

export const stoneQueryBuilder = async (
  filters: StoneFilter,
  companyId: number,
  show_hidden: boolean = false
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
    s.length, 
    s.width,
    s.created_date, 
    s.on_sale,
    s.retail_price,
    s.cost_per_sqft,
    COUNT(si.stone_id) AS amount,
    CAST(SUM(CASE WHEN si.is_sold = 0 THEN 1 ELSE 0 END) AS UNSIGNED) AS available
  FROM main.stones s
  LEFT JOIN main.slab_inventory AS si ON si.stone_id = s.id
  WHERE s.company_id = ?
  `;
  if (!show_hidden) {
    query += " AND s.is_display = 1";
  }
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
      s.length,
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

export interface Sink {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  length: number | null;
  width: number | null;
  amount: number | null;
  supplier_id: number | null;
  retail_price: number | null;
  cost: number | null;
 
}

export async function sinkQueryBuilder(
  filters: SinkFilter,
  companyId: number | string
): Promise<Sink[]> {
  const { type, show_sold_out, supplier } = filters;
  const numericCompanyId = typeof companyId === 'string' ? Number(companyId) : companyId;
  
  let whereClause = "WHERE company_id = ?";
  let params: (string | number | boolean)[] = [numericCompanyId];

  if (type && type.length > 0 && type.length < 5) {
    whereClause += " AND type IN (?)";
    params.push(type.join(","));
  }

  if (supplier > 0) {
    whereClause += " AND supplier_id = ?";
    params.push(supplier);
  }

  if (!show_sold_out) {
    whereClause += " AND (amount IS NOT NULL AND amount > 0)";
  }

  const query = `
    SELECT id, name, type, url, is_display, length, width, amount, supplier_id, retail_price, cost
    FROM sinks
    ${whereClause}
    ORDER BY name ASC
  `;

  const sinks = await selectMany<Sink>(db, query, params);
  return sinks;
}
