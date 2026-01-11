import { db } from "~/db.server";
import { SaleSink } from "~/types/sales";
import { selectMany } from "~/utils/queryHelpers";

export async function getSlabInventorySinks(saleId: number) {
    return await selectMany<SaleSink>(
    db,
    `SELECT
      sinks.id,
      sinks.sink_type_id,
      sink_type.name,
      sinks.price,
      sinks.is_deleted,
      sinks.slab_id,
      slab_inventory.room,
      HEX(slab_inventory.room_uuid) as room_uuid
     FROM sinks
     JOIN sink_type ON sinks.sink_type_id = sink_type.id
     JOIN slab_inventory ON sinks.slab_id = slab_inventory.id
     WHERE slab_inventory.sale_id = ? AND sinks.is_deleted = 0
     ORDER BY sinks.id`,
    [saleId],
  )}