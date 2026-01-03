import { db } from "~/db.server"
import { SaleSlab } from "~/types/sales"
import { selectMany } from "~/utils/queryHelpers"

export interface SlabInventoryMain {
  id: number
  stone_id: number
  bundle: string
  url: string | null
  parent_id: number | null
  sale_id: number | null
  length: number
  width: number
}

// FULL - полная запись из slab_inventory
export interface SlabInventory extends SlabInventoryMain {
  notes: string | null
  price: number | null
  square_feet: number | null

  room: string | null
  room_uuid: Buffer | null

  seam: string | null
  backsplash: string | null
  tear_out: string | null
  stove: string | null
  ten_year_sealer: string | null
  waterfall: string | null
  corbels: string | null
  extras: string | null
  edge: string | null

  cut_date: string | null
}

// SLABS IN SALE - отличается (sale_id обязателен)
export interface SlabsInSale extends SlabInventoryMain {
  sale_id: number
  cut_date: string | null
}

// TEMPLATE - отдельная структура (не row из slab_inventory)
export interface SlabInventoryTemplate {
  room_uuid: Buffer | null
  seam: string | null
  room: string | null
  backsplash: string | null
  tear_out: string | null
  square_feet: number | null
  stove: string | null
  ten_year_sealer: string | null
  waterfall: string | null
  corbels: string | null
  price: number | null
  extras: string | null
  edge: string | null
}

export async function insertSlabInventory(
  stoneId: number,
  bundle: string,
  parentId: number,
  length: number,
  width: number,
  url: string | null,
) {
  await db.execute(
    `INSERT INTO slab_inventory (stone_id, bundle, parent_id, length, width, url)
     VALUES (?,?,?,?,?,?)`,
    [stoneId, bundle, parentId, length, width, url],
  )
}

export async function getSlabInventoryParent(slabId: number, saleId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        id,
        stone_id,
        bundle,
        url,
        parent_id,
        sale_id,
        length,
        width,
        notes,
        price,
        square_feet,
        room,
        room_uuid,
        seam,
        backsplash,
        tear_out,
        stove,
        ten_year_sealer,
        waterfall,
        corbels,
        extras,
        edge,
        cut_date
       FROM slab_inventory
      WHERE id = ? AND sale_id = ?`,
    [slabId, saleId],
  )
}

export async function getSlabInventoryChildren(saleId: number) {
  return await selectMany<SaleSlab>(
    db,
    `SELECT
      slab_inventory.id,
      slab_inventory.stone_id,
      slab_inventory.bundle,
      stones.name as stone_name,
      slab_inventory.cut_date,
      slab_inventory.notes,
      slab_inventory.square_feet,
      slab_inventory.length,
      slab_inventory.width,
      HEX(slab_inventory.room_uuid) as room_uuid,
      slab_inventory.room,
      slab_inventory.parent_id,
      (SELECT COUNT(*) FROM slab_inventory c WHERE c.parent_id = slab_inventory.id AND c.deleted_at IS NULL) as child_count
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.sale_id = ?
     ORDER BY slab_inventory.id`,
    [saleId],
  )
}

export async function updateChildSlabInventory(
  slabId: number,
  saleId: number,
  template: SlabInventory,
  newSlabId: number,
) {
  await db.execute(
    `UPDATE slab_inventory
       SET sale_id = ?,
           room = ?,
           room_uuid = ?,
           seam = ?,
           backsplash = ?,
           tear_out = ?,
           square_feet = ?,
           stove = ?,
           ten_year_sealer = ?,
           waterfall = ?,
           corbels = ?,
           price = ?,
           extras = ?,
           edge = ?,
           notes = ?,
           cut_date = ?
     WHERE id = ? AND sale_id IS NULL`,
    [
      saleId,
      template.room ?? null,
      template.room_uuid ?? null,
      template.seam ?? null,
      template.backsplash ?? null,
      template.tear_out ?? null,
      template.square_feet ?? null,
      template.stove ?? null,
      template.ten_year_sealer ?? null,
      template.waterfall ?? null,
      template.corbels ?? null,
      template.price ?? null,
      template.extras ?? null,
      template.edge ?? null,
      template.notes ?? null,
      template.cut_date ?? null,
      newSlabId,
    ],
  )

  // slabId сейчас не используется - если не нужен, можно убрать из сигнатуры
}

export async function removeOldSlabFromSale(slabId: number, saleId: number) {
  await db.execute(
    `UPDATE slab_inventory
       SET sale_id = NULL,
           notes = NULL,
           price = NULL,
           square_feet = NULL,
           cut_date = NULL,
           room = NULL,
           waterfall = NULL,
           corbels = NULL,
           seam = NULL,
           stove = NULL,
           extras = NULL,
           room_uuid = NULL,
           edge = NULL,
           backsplash = NULL,
           tear_out = NULL,
           ten_year_sealer = NULL
     WHERE id = ? AND sale_id = ?`,
    [slabId, saleId],
  )
}

export async function getExistingSlabInSale(oldSlabId: number, saleId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        id,
        stone_id,
        bundle,
        url,
        parent_id,
        sale_id,
        length,
        width,
        notes,
        price,
        square_feet,
        cut_date,
        room,
        room_uuid,
        seam,
        backsplash,
        tear_out,
        stove,
        ten_year_sealer,
        waterfall,
        corbels,
        extras,
        edge
       FROM slab_inventory
      WHERE id = ? AND sale_id = ?`,
    [oldSlabId, saleId],
  )
}

export async function getFirstChildSlabInSale(slabId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        si.id,
        si.stone_id,
        si.bundle,
        si.url,
        si.parent_id,
        si.sale_id,
        si.length,
        si.width,
        si.notes,
        si.price,
        si.square_feet,
        si.room,
        si.room_uuid,
        si.seam,
        si.backsplash,
        si.tear_out,
        si.stove,
        si.ten_year_sealer,
        si.waterfall,
        si.corbels,
        si.extras,
        si.edge,
        si.cut_date
      FROM slab_inventory si
     WHERE si.parent_id = ?
       AND si.deleted_at IS NULL
       AND si.sale_id IS NOT NULL
     ORDER BY si.id ASC
     LIMIT 1`,
    [slabId],
  )
}

export async function getNewSlabInventory(slabId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        si.id,
        si.stone_id,
        si.bundle,
        si.url,
        si.parent_id,
        si.sale_id,
        si.length,
        si.width,
        si.notes,
        si.price,
        si.square_feet,
        si.room,
        si.room_uuid,
        si.seam,
        si.backsplash,
        si.tear_out,
        si.stove,
        si.ten_year_sealer,
        si.waterfall,
        si.corbels,
        si.extras,
        si.edge,
        si.cut_date
      FROM slab_inventory si
     WHERE si.parent_id = ?
       AND si.deleted_at IS NULL
     ORDER BY (si.sale_id IS NOT NULL) DESC, si.id ASC
     LIMIT 1`,
    [slabId],
  )
}

export async function getActualParentInSale(parentId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        si.id,
        si.stone_id,
        si.bundle,
        si.url,
        si.parent_id,
        si.sale_id,
        si.length,
        si.width,
        si.notes,
        si.price,
        si.square_feet,
        si.room,
        si.room_uuid,
        si.seam,
        si.backsplash,
        si.tear_out,
        si.stove,
        si.ten_year_sealer,
        si.waterfall,
        si.corbels,
        si.extras,
        si.edge,
        si.cut_date
       FROM slab_inventory si
      WHERE si.id = ?
        AND si.deleted_at IS NULL
        AND si.sale_id IS NOT NULL`,
    [parentId],
  )
}

export async function insertNewSlabInventory(
  template: SlabInventory,
  parentForNew: number,
  soldTarget: SlabInventory | null,
  length: number,
  width: number,
) {
  await db.execute(
    `INSERT INTO slab_inventory (
       stone_id,
       bundle,
       parent_id,
       sale_id,
       length,
       width,
       url,
       notes,
       price,
       square_feet,
       room,
       room_uuid,
       seam,
       backsplash,
       tear_out,
       stove,
       ten_year_sealer,
       waterfall,
       corbels,
       extras,
       edge
     )
     VALUES (
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?,
       ?
     )`,
    [
      template.stone_id,
      template.bundle,
      parentForNew,
      soldTarget && soldTarget.sale_id !== null ? soldTarget.sale_id : null,
      length,
      width,
      template.url ?? null,
      template.notes ?? null,
      template.price ?? null,
      template.square_feet ?? null,
      template.room ?? null,
      template.room_uuid ?? null,
      template.seam ?? null,
      template.backsplash ?? null,
      template.tear_out ?? null,
      template.stove ?? null,
      template.ten_year_sealer ?? null,
      template.waterfall ?? null,
      template.corbels ?? null,
      template.extras ?? null,
      template.edge ?? null,
    ],
  )
}

export async function AddSlabToSale(
  template: SlabInventoryTemplate,
  slabId: number,
  saleId: number,
  room: string | null,
  roomUuidValue: Buffer | null,
) {
  await db.execute(
    `UPDATE slab_inventory
       SET sale_id = ?,
           room = ?,
           room_uuid = ?,
           seam = ?,
           backsplash = ?,
           tear_out = ?,
           square_feet = ?,
           stove = ?,
           ten_year_sealer = ?,
           waterfall = ?,
           corbels = ?,
           price = ?,
           extras = ?,
           edge = ?,
           notes = NULL,
           cut_date = NULL
     WHERE id = ? AND sale_id IS NULL`,
    [
      saleId,
      room,
      roomUuidValue,
      template?.seam ?? null,
      template?.backsplash ?? null,
      template?.tear_out ?? null,
      template?.square_feet ?? null,
      template?.stove ?? null,
      template?.ten_year_sealer ?? null,
      template?.waterfall ?? null,
      template?.corbels ?? null,
      template?.price ?? null,
      template?.extras ?? null,
      template?.edge ?? null,
      slabId,
    ],
  )
}

export async function getFirstChildFromParentPreferWithSale(slabId: number) {
  return await selectMany<SlabInventory>(
    db,
    `SELECT
        si.id,
        si.stone_id,
        si.bundle,
        si.url,
        si.parent_id,
        si.sale_id,
        si.length,
        si.width,
        si.notes,
        si.price,
        si.square_feet,
        si.room,
        si.room_uuid,
        si.seam,
        si.backsplash,
        si.tear_out,
        si.stove,
        si.ten_year_sealer,
        si.waterfall,
        si.corbels,
        si.extras,
        si.edge,
        si.cut_date
      FROM slab_inventory si
     WHERE si.parent_id = ?
       AND si.deleted_at IS NULL
     ORDER BY (si.sale_id IS NOT NULL) DESC, si.id ASC
     LIMIT 1`,
    [slabId],
  )
}

export async function getSlabsInSale(slabId: number, saleId: number) {
  return await selectMany<SlabsInSale>(
    db,
    `SELECT
        id,
        sale_id,
        cut_date,
        stone_id,
        parent_id,
        length,
        width,
        bundle,
        url
      FROM slab_inventory
     WHERE id = ? AND sale_id = ?`,
    [slabId, saleId],
  )
}

export async function getFirstUnsoldChildFromParent(
  slabId: number,
  length: number,
  width: number,
) {
  return await selectMany<{ id: number }>(
    db,
    `SELECT id FROM slab_inventory
     WHERE parent_id = ?
       AND sale_id IS NULL
       AND length = ?
       AND width = ?
     ORDER BY id ASC
     LIMIT 1`,
    [slabId, length, width],
  )
}

export async function selectForRoomUuid(saleId: number, roomUuid: string) {
  const templateQuery = `SELECT room_uuid, seam, room, backsplash, tear_out, square_feet, stove, ten_year_sealer, waterfall, corbels, price, extras, edge
           FROM slab_inventory
          WHERE sale_id = ? AND HEX(room_uuid) = ?
          ORDER BY id
          LIMIT 1`
  return await selectMany<SlabInventoryTemplate>(db, templateQuery, [saleId, roomUuid])
}

export async function selectForRoom(saleId: number, room: string) {
  const templateQuery = `SELECT room_uuid, seam, room, backsplash, tear_out, square_feet, stove, ten_year_sealer, waterfall, corbels, price, extras, edge
           FROM slab_inventory
          WHERE sale_id = ? AND (room = ? OR ? IS NULL)
          ORDER BY id
          LIMIT 1`
  return await selectMany<SlabInventoryTemplate>(db, templateQuery, [saleId, room, room])
}
