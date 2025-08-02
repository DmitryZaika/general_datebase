import { v7 as uuidv7 } from 'uuid'
import { db } from '~/db.server'
import {
  customerSchema,
  EXTRA_DEFAULTS,
  extrasSchema,
  type TCustomerSchema,
  type TExtrasSchema,
  type TFullExtrasSchema,
} from '~/schemas/sales'
import { selectId, selectMany } from '~/utils/queryHelpers'
import type { CUSTOMER_ITEMS } from './constants'

interface Sale {
  customer_id: number
  seller_id: number | null
  notes: string | null
  price: number | null
  project_address: string | null
  square_feet: number | null
  name: string
  address: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  builder: boolean | null
  company_name: string | null
  extras: TFullExtrasSchema | null
}

interface Slab {
  id: number
  room_id: string
  room: string | null
  seam: string | null
  edge: keyof typeof CUSTOMER_ITEMS.edge_price.edge_type | null
  backsplash: string | null
  tear_out: string | null
  square_feet: number | null
  stove: string | null
  ten_year_sealer: number | boolean | null
  waterfall: string | null
  corbels: number | null
  retail_price: number | null
  extras: TExtrasSchema | null
}

interface Sink {
  type_id: number
  id: number
}

interface FullSink extends Sink {
  slab_id: number
}

const getSale = async (saleId: number): Promise<Sale | undefined> => {
  return await selectId<Sale>(
    db,
    `SELECT
          s.customer_id,
          s.seller_id,
          s.notes,
          s.price,
          s.project_address,
          s.square_feet,
          s.extras,
          c.name,
          c.address,
          c.postal_code,
          c.phone,
          c.email,
          c.company_name
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ?`,
    saleId,
  )
}

const getSlabs = async (saleId: number): Promise<Slab[]> => {
  return await selectMany<Slab>(
    db,
    `SELECT 
          slab_inventory.id,
          BIN_TO_UUID(slab_inventory.room_uuid) AS room_id,
          slab_inventory.room,
          slab_inventory.seam,
          slab_inventory.edge,
          slab_inventory.backsplash,
          slab_inventory.tear_out,
          slab_inventory.square_feet,
          slab_inventory.stove,
          slab_inventory.ten_year_sealer,
          slab_inventory.waterfall,
          slab_inventory.corbels,
          slab_inventory.price AS retail_price,
          slab_inventory.extras
       FROM slab_inventory
       WHERE slab_inventory.sale_id = ?`,
    [saleId],
  )
}

const getSinks = async (slabIds: number[]): Promise<Record<number, Sink[]>> => {
  if (!slabIds.length) return {}
  const placeholders = slabIds.map(() => '?').join(',')
  const sinkMap: Record<number, Sink[]> = {}
  const sinkRows = await selectMany<FullSink>(
    db,
    `SELECT slab_id, id, sink_type_id as type_id FROM sinks WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
    slabIds,
  )
  sinkRows.forEach(row => {
    if (!sinkMap[row.slab_id]) sinkMap[row.slab_id] = []
    sinkMap[row.slab_id].push({ id: row.id, type_id: row.type_id })
  })
  return sinkMap
}

const getFaucets = async (slabIds: number[]): Promise<Record<number, Sink[]>> => {
  if (!slabIds.length) return {}
  const placeholders = slabIds.map(() => '?').join(',')
  const faucetMap: Record<number, Sink[]> = {}
  const faucetRows = await selectMany<FullSink>(
    db,
    `SELECT slab_id, id, faucet_type_id as type_id FROM faucets WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
    slabIds,
  )

  faucetRows.forEach(row => {
    if (!faucetMap[row.slab_id]) faucetMap[row.slab_id] = []
    faucetMap[row.slab_id].push({ id: row.id, type_id: row.type_id })
  })
  return faucetMap
}

const getChildren = async (slabIds: number[]): Promise<Set<number>> => {
  if (!slabIds.length) return new Set()
  const placeholders = slabIds.map(() => '?').join(',')
  const children = await selectMany<{ parent_id: number }>(
    db,
    `SELECT DISTINCT parent_id FROM slab_inventory WHERE parent_id IN (${placeholders})`,
    slabIds,
  )
  return new Set(children.map(c => c.parent_id))
}

export async function getCustomerSchemaFromSaleId(
  saleId: number,
): Promise<TCustomerSchema | null> {
  const sale = await getSale(saleId)
  if (!sale) return null

  const slabs = await getSlabs(saleId)
  if (slabs.length === 0) {
    return null
  }

  const slabIds = slabs.map(s => s.id)
  const partialParentIds = await getChildren(slabIds)

  const sinkMap = await getSinks(slabIds)
  const faucetMap = await getFaucets(slabIds)

  const roomsMap: Record<string, TCustomerSchema['rooms'][number]> = {}

  slabs.forEach(slab => {
    const roomId = slab.room_id

    const extras = extrasSchema.parse(slab.extras || EXTRA_DEFAULTS)

    if (!roomsMap[roomId]) {
      roomsMap[roomId] = {
        room: slab.room || 'kitchen',
        room_id: roomId || uuidv7(), // Backwards compatibility
        sink_type: sinkMap[slab.id] || [],
        faucet_type: faucetMap[slab.id] || [],
        backsplash: slab.backsplash || 'no',
        square_feet: slab.square_feet || 0,
        retail_price: slab.retail_price || 0,
        total_price: undefined,
        tear_out: slab.tear_out || 'no',
        stove: slab.stove || 'f/s',
        waterfall: slab.waterfall || 'no',
        corbels: slab.corbels || 0,
        seam: slab.seam || 'standard',
        ten_year_sealer: Boolean(slab.ten_year_sealer),
        slabs: [],
        extras,
      }
    }

    // Append slab reference
    roomsMap[roomId].slabs.push({
      id: slab.id,
      is_full: !partialParentIds.has(slab.id),
    })
  })

  // 6. Build final schema object
  const final: TCustomerSchema = {
    name: sale.name,
    customer_id: sale.customer_id,
    seller_id: sale.seller_id || undefined,
    billing_address: sale.address || '',
    project_address: sale.project_address || '',
    same_address: (sale.project_address || '') === (sale.address || ''),
    price: sale.price || 0,
    notes_to_sale: sale.notes || '',
    rooms: Object.values(roomsMap),
    extras: sale.extras || [],
    company_name: sale.company_name || null,
  }
  return customerSchema.parse(final)
}
