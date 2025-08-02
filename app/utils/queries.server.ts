import { db } from '~/db.server'
import type { FaucetFilter } from '~/schemas/faucets'
import type { SinkFilter } from '~/schemas/sinks'
import type { StoneFilter } from '~/schemas/stones'
import { selectMany } from '~/utils/queryHelpers'
import type { SINK_TYPES } from './constants'

export interface Stone {
  id: number
  name: string
  type: string
  url: string | null
  is_display: number
  length: number | null
  width: number | null
  amount: number
  available: number
  created_date: string
  on_sale: boolean
  retail_price: number
  cost_per_sqft: number
  level: number | null
  finishing: string | null
  samples_amount: number
  samples_importance: number | null
}

export const stoneQueryBuilder = async (
  filters: StoneFilter,
  companyId: number,
  show_hidden: boolean = false,
): Promise<Stone[]> => {
  const params: (string | number)[] = [companyId]
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
    stones.level,
    stones.finishing,
    stones.samples_amount,
    stones.samples_importance,
    COUNT(DISTINCT CASE WHEN slab_inventory.id IS NOT NULL AND (slab_inventory.cut_date IS NULL) THEN slab_inventory.id ELSE NULL END) AS amount,
    CAST(SUM(CASE WHEN slab_inventory.id IS NOT NULL AND slab_inventory.sale_id IS NULL AND slab_inventory.cut_date IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) AS available
  FROM stones
  LEFT JOIN slab_inventory ON slab_inventory.stone_id = stones.id AND slab_inventory.cut_date IS NULL
  `

  query += `WHERE stones.company_id = ?`

  if (!show_hidden) {
    query += ' AND stones.is_display = 1'
  }

  if (filters.type && filters.type.length > 0) {
    query += ` AND stones.type IN (${filters.type.map(() => '?').join(', ')})`
    params.push(...filters.type)
  }

  if (filters.supplier > 0) {
    query += ' AND stones.supplier_id = ?'
    params.push(filters.supplier)
  }

  if (filters.colors && filters.colors.length > 0) {
    query += ` AND EXISTS (
      SELECT 1 FROM stone_colors 
      WHERE stone_colors.stone_id = stones.id 
      AND stone_colors.color_id IN (${filters.colors.map(() => '?').join(', ')})
    )`
    params.push(...filters.colors)
  }

  if (filters.level && filters.level.length > 0) {
    query += ` AND stones.level IN (${filters.level.map(() => '?').join(', ')})`
    params.push(...filters.level)
  }

  if (filters.finishing && filters.finishing.length > 0) {
    query += ` AND stones.finishing IN (${filters.finishing.map(() => '?').join(', ')})`
    params.push(...filters.finishing)
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
      stones.on_sale,
      stones.level,
      stones.finishing,
      stones.samples_amount,
      stones.samples_importance
    `
  if (!filters.show_sold_out) {
    query += `\nHAVING available > 0`
  }
  query += `\nORDER BY stones.name ASC`
  return await selectMany<Stone>(db, query, params)
}

export interface Sink {
  id: number
  name: string
  type: (typeof SINK_TYPES)[number]
  url: string | null
  is_display: boolean | number
  length: number | null
  width: number | null
  amount: number | null
  supplier_id: number | null
  retail_price: number | null
  cost: number | null
}

export async function sinkQueryBuilder(
  filters: SinkFilter,
  companyId: number | string,
): Promise<Sink[]> {
  const { type, show_sold_out, supplier } = filters
  const numericCompanyId = typeof companyId === 'string' ? Number(companyId) : companyId

  let whereClause = 'WHERE sink_type.company_id = ? AND sink_type.is_deleted = 0'
  const params: (string | number)[] = [numericCompanyId]

  if (type && type.length > 0 && type.length < 5) {
    whereClause += ` AND sink_type.type IN (${type.map(() => '?').join(',')})`
    params.push(...type)
  }

  if (supplier > 0) {
    whereClause += ' AND sink_type.supplier_id = ?'
    params.push(supplier)
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
  `

  const sinks = await selectMany<Sink>(db, query, params)

  return show_sold_out ? sinks : sinks.filter(sink => (sink.amount || 0) > 0)
}

export interface Faucet {
  id: number
  name: string
  type: string
  url: string | null
  is_display: boolean | number
  amount: number | null
  supplier_id: number | null
  retail_price: number | null
  cost: number | null
}

export async function faucetQueryBuilder(
  filters: FaucetFilter,
  companyId: number | string,
): Promise<Faucet[]> {
  const { type, show_sold_out, supplier } = filters
  const numericCompanyId = typeof companyId === 'string' ? Number(companyId) : companyId

  let whereClause = 'WHERE faucet_type.company_id = ? AND faucet_type.is_deleted = 0'
  const params: (string | number)[] = [numericCompanyId]

  if (type && type.length > 0 && type.length < 7) {
    whereClause += ` AND faucet_type.type IN (${type.map(() => '?').join(',')})`
    params.push(...type)
  }

  if (supplier > 0) {
    whereClause += ' AND faucet_type.supplier_id = ?'
    params.push(supplier)
  }

  const query = `
    SELECT 
      faucet_type.id, 
      faucet_type.name, 
      faucet_type.type, 
      faucet_type.url, 
      faucet_type.is_display, 
      COUNT(faucets.id) AS amount, 
      faucet_type.supplier_id, 
      faucet_type.retail_price, 
      faucet_type.cost
    FROM faucet_type
    LEFT JOIN faucets ON faucets.faucet_type_id = faucet_type.id AND faucets.is_deleted = 0
    ${whereClause}
    GROUP BY
      faucet_type.id,
      faucet_type.name,
      faucet_type.type,
      faucet_type.url,
      faucet_type.is_display,
      faucet_type.supplier_id,
      faucet_type.retail_price,
      faucet_type.cost
    ORDER BY faucet_type.name ASC
  `

  const faucets = await selectMany<Faucet>(db, query, params)

  return show_sold_out ? faucets : faucets.filter(faucet => (faucet.amount || 0) > 0)
}
