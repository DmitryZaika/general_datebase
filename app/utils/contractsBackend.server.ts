import { db } from '~/db.server'
import { extrasSchema, type TCustomerSchema, type TExtrasSchema } from '~/schemas/sales'
import { selectId, selectMany } from '~/utils/queryHelpers'

export async function getCustomerSchemaFromSaleId(
  saleId: number,
): Promise<TCustomerSchema | null> {
  const sale = await selectId<{
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
  }>(
    db,
    `SELECT
          s.customer_id,
          s.seller_id,
          s.notes,
          s.price,
          s.project_address,
          s.square_feet,
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

  if (!sale) return null

  // 2. Gather all slabs that belong to this sale
  const slabs = await selectMany<{
    id: number
    room_id: string // converted UUID
    room: string | null
    seam: string | null
    edge: string | null
    backsplash: string | null
    tear_out: string | null
    square_feet: number | null
    stove: string | null
    ten_year_sealer: number | boolean | null
    waterfall: string | null
    corbels: number | null
    retail_price: number | null
    extras: TExtrasSchema
  }>(
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

  if (slabs.length === 0) {
    return null // No slabs linked, something is off
  }

  const slabIds = slabs.map(s => s.id)

  // 3. Identify which slabs are full vs partial (has leftover child slabs)
  let partialParentIds: Set<number> = new Set()
  if (slabIds.length) {
    const placeholders = slabIds.map(() => '?').join(',')
    const children = await selectMany<{ parent_id: number }>(
      db,
      `SELECT DISTINCT parent_id FROM slab_inventory WHERE parent_id IN (${placeholders})`,
      slabIds,
    )
    partialParentIds = new Set(children.map(c => c.parent_id))
  }

  // 4. Fetch sinks and faucets for these slabs
  const sinkMap: Record<number, number[]> = {}
  const faucetMap: Record<number, number[]> = {}

  if (slabIds.length) {
    const placeholders = slabIds.map(() => '?').join(',')

    const sinkRows = await selectMany<{
      slab_id: number
      sink_type_id: number
    }>(
      db,
      `SELECT slab_id, sink_type_id FROM sinks WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
      slabIds,
    )

    sinkRows.forEach(row => {
      if (!sinkMap[row.slab_id]) sinkMap[row.slab_id] = []
      sinkMap[row.slab_id].push(row.sink_type_id)
    })

    const faucetRows = await selectMany<{
      slab_id: number
      faucet_type_id: number
    }>(
      db,
      `SELECT slab_id, faucet_type_id FROM faucets WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
      slabIds,
    )

    faucetRows.forEach(row => {
      if (!faucetMap[row.slab_id]) faucetMap[row.slab_id] = []
      faucetMap[row.slab_id].push(row.faucet_type_id)
    })
  }

  // 5. Assemble rooms based on room_uuid
  const roomsMap: Record<string, TCustomerSchema['rooms'][number]> = {}

  slabs.forEach(slab => {
    const roomId = slab.room_id

    const extras = extrasSchema.parse(slab.extras)

    if (!roomsMap[roomId]) {
      roomsMap[roomId] = {
        room: slab.room || 'kitchen',
        room_id: roomId,
        sink_type: [],
        faucet_type: [],
        edge: slab.edge || 'flat',
        backsplash: slab.backsplash || 'no',
        square_feet: slab.square_feet || 0,
        retail_price: slab.retail_price || 0,
        total_price: undefined, // can be calculated later if needed
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

    // Merge sinks/faucets (ensure uniqueness)
    const sinkIds = sinkMap[slab.id] || []
    const faucetIds = faucetMap[slab.id] || []

    sinkIds.forEach(sid => {
      if (!roomsMap[roomId].sink_type.some(s => s.id === sid)) {
        roomsMap[roomId].sink_type.push({ id: sid })
      }
    })

    faucetIds.forEach(fid => {
      if (!roomsMap[roomId].faucet_type.some(f => f.id === fid)) {
        roomsMap[roomId].faucet_type.push({ id: fid })
      }
    })
  })

  // 6. Build final schema object
  const customerSchema: TCustomerSchema = {
    name: sale.name,
    customer_id: sale.customer_id,
    seller_id: sale.seller_id || undefined,
    billing_address: sale.address || '',
    billing_zip_code: sale.postal_code || undefined,
    project_address: sale.project_address || '',
    same_address: (sale.project_address || '') === (sale.address || ''),
    phone: sale.phone || '',
    email: sale.email || '',
    price: sale.price || 0,
    notes_to_sale: sale.notes || '',
    rooms: Object.values(roomsMap),
 
    company_name: sale.company_name || null,
  }

  return customerSchema
}
