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
    stones.id, 
    stones.name, 
    stones.type, 
    stones.url, 
    stones.is_display, 
    stones.length, 
    stones.width,
    stones.created_date, 
    stones.on_sale,
    stones.retail_price,
    stones.cost_per_sqft,
    COUNT(CASE WHEN slab_inventory.id IS NOT NULL AND (slab_inventory.cut_date IS NULL  OR slab_inventory.cut_date IS NOT NULL) THEN 1 ELSE NULL END) AS amount,
    CAST(SUM(CASE WHEN slab_inventory.id IS NOT NULL AND slab_inventory.sale_id IS NULL AND (slab_inventory.cut_date IS NULL OR slab_inventory.cut_date IS NOT NULL) THEN 1 ELSE 0 END) AS UNSIGNED) AS available
  FROM stones
  LEFT JOIN slab_inventory ON slab_inventory.stone_id = stones.id
  WHERE stones.company_id = ?
  `;
  if (!show_hidden) {
    query += " AND stones.is_display = 1";
  }
  if (filters.type.length < STONE_TYPES.length) {
    query += ` AND stones.type IN (${filters.type.map(() => "?").join(", ")})`;
    params.push(...filters.type);
  }
  if (filters.supplier > 0) {
    query += " AND stones.supplier_id = ?";
    params.push(filters.supplier);
  }
  query += `
    GROUP BY
      stones.id,
      stones.name,
      stones.type,
      stones.url,
      stones.is_display,
      stones.length,
      stones.width,
      stones.created_date,
      stones.on_sale
    `;
  if (!filters.show_sold_out) {
    query += `\nHAVING available > 0`;
  }
  query += `\nORDER BY stones.name ASC`;
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
  
  let whereClause = "WHERE sink_type.company_id = ? AND sink_type.is_deleted = 0";
  let params: (string | number | boolean)[] = [numericCompanyId];

  if (type && type.length > 0 && type.length < 5) {
    whereClause += " AND sink_type.type IN (?)";
    params.push(type.join(","));
  }

  if (supplier > 0) {
    whereClause += " AND sink_type.supplier_id = ?";
    params.push(supplier);
  }

  const query = `
    SELECT 
      sink_type.id, 
      sink_type.name, 
      sink_type.type, 
      sink_type.url, 
      sink_type.is_display, 
      sink_type.length, 
      sink_type.width, 
      COUNT(sinks.id) AS amount, 
      sink_type.supplier_id, 
      sink_type.retail_price, 
      sink_type.cost
    FROM sink_type
    LEFT JOIN sinks ON sinks.sink_type_id = sink_type.id AND sinks.is_deleted = 0
    ${whereClause}
    GROUP BY
      sink_type.id,
      sink_type.name,
      sink_type.type,
      sink_type.url,
      sink_type.is_display,
      sink_type.length,
      sink_type.width,
      sink_type.supplier_id,
      sink_type.retail_price,
      sink_type.cost
    ORDER BY sink_type.name ASC
  `;

  const sinks = await selectMany<Sink>(db, query, params);
  
  return show_sold_out ? sinks : sinks.filter(sink => (sink.amount || 0) > 0);
}
