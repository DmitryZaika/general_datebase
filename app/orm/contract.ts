import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { db } from '~/db.server'
import type { TCustomerSchema, TRoomSchema } from '~/schemas/sales'
import { getCustomerSchemaFromSaleId } from '~/utils/contractsBackend.server'
import type { User } from '~/utils/session.server'

export class Contract {
  data: TCustomerSchema
  saleId: number | null = null

  constructor(data: TCustomerSchema, saleId: number | null = null) {
    this.data = data
    this.saleId = saleId
  }

  private async getCustomerAddress(user: User) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT address FROM customers WHERE id = ? AND company_id = ? LIMIT 1`,
      [this.data.customer_id, user.company_id],
    )
    return rows[0]?.address ?? ''
  }

  static async fromSalesId(salesId: number) {
    const data = await getCustomerSchemaFromSaleId(salesId)
    if (!data) {
      throw new Error('Sale not found')
    }
    return new Contract(data, salesId)
  }

  protected async createSale(user: User) {
    const totalSquareFeet = await this.calculateTotalSquareFeet()
    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price, project_address, extras) 
               VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?, ?, ?)`,

      [
        this.data.customer_id,
        user.id,
        user.company_id,
        this.data.notes_to_sale || null,
        totalSquareFeet,
        this.data.price,
        this.data.project_address || (await this.getCustomerAddress(user)),
        this.data.extras,
      ],
    )

    return salesResult.insertId
  }

  protected async deleteSale() {
    await db.execute<ResultSetHeader>(
      `UPDATE  sales SET cancelled_date = CURRENT_TIMESTAMP, status = 'cancelled' WHERE id = ?`,
      [this.saleId],
    )
  }

  protected async updateSlab(slabId: number, room: TRoomSchema) {
    await db.execute(
      `UPDATE slab_inventory SET room_uuid = UUID_TO_BIN(?), seam = ?,  room = ?, backsplash = ?, tear_out = ?, square_feet = ?, stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ?, sale_id = ? WHERE id = ?`,
      [
        room.room_id,
        room.seam,
        room.room,
        room.backsplash,
        room.tear_out,
        room.square_feet,
        room.stove,
        room.ten_year_sealer,
        room.waterfall,
        room.corbels,
        room.retail_price,
        room.extras,
        this.saleId,
        slabId,
      ],
    )
  }

  protected async updateSale(user: User) {
    if (this.saleId === null) {
      throw new Error('Sale not found')
    }
    const totalSquareFeet = await this.calculateTotalSquareFeet()
    await db.execute(
      `UPDATE sales SET customer_id = ?, notes = ?, square_feet = ?, price = ?, project_address = ?, extras = ? WHERE id = ? AND company_id = ?`,
      [
        this.data.customer_id,
        this.data.notes_to_sale || null,
        totalSquareFeet,
        this.data.price || 0,
        this.data.project_address || this.data.billing_address,
        this.data.extras,
        this.saleId,
        user.company_id,
      ],
    )
  }

  protected async updateCompanyName(customerId: number, user: User) {
    if (typeof this.data.company_name === 'undefined') return

    await db.execute(
      `UPDATE customers SET company_name = ? WHERE id = ? AND company_id = ?`,
      [this.data.company_name || null, customerId, user.company_id],
    )
  }

  protected async calculateTotalSquareFeet() {
    return this.data.rooms.reduce((sum, room) => sum + (room.square_feet || 0), 0)
  }

  protected async sellSlab(slabId: number, room: TRoomSchema) {
    await db.execute(
      `UPDATE slab_inventory SET sale_id = ?, room_uuid = UUID_TO_BIN(?), seam = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ? WHERE id = ?`,
      [
        this.saleId,
        room.room_id,
        room.seam,
        room.room,
        room.backsplash,
        room.tear_out,
        room.square_feet,
        room.stove,
        room.ten_year_sealer,
        room.waterfall,
        room.corbels,
        room.retail_price,
        room.extras,
        slabId,
      ],
    )
  }

  protected async unsellSlab(slabId: number) {
    await db.execute(
      `UPDATE slab_inventory SET sale_id = NULL, room_uuid = NULL, seam = NULL, room = NULL, backsplash = NULL, tear_out = NULL, square_feet = NULL,
            stove = NULL, ten_year_sealer = NULL, waterfall = NULL, corbels = NULL, price = NULL, extras = NULL WHERE id = ?`,
      [slabId],
    )
  }

  protected async unsellSlabs(saleId: number) {
    await db.execute(
      `UPDATE slab_inventory SET sale_id = NULL, room_uuid = NULL, seam = NULL, room = NULL, backsplash = NULL, tear_out = NULL, square_feet = NULL,
          stove = NULL, ten_year_sealer = NULL, waterfall = NULL, corbels = NULL, price = NULL, extras = NULL WHERE sale_id = ?`,
      [saleId],
    )
  }

  protected async sellSink(slabId: number, sinkTypeId: number) {
    await db.execute(
      `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 ORDER BY id LIMIT 1`,
      [slabId, sinkTypeId],
    )
  }

  protected async unsellSink(slabId: number) {
    await db.execute(`UPDATE sinks SET slab_id = NULL WHERE slab_id = ?`, [slabId])
  }

  protected async sellFaucet(slabId: number, faucetTypeId: number) {
    await db.execute(
      `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 ORDER BY id LIMIT 1`,
      [slabId, faucetTypeId],
    )
  }

  protected async unsellFaucet(slabId: number) {
    await db.execute(`UPDATE faucets SET slab_id = NULL WHERE slab_id = ?`, [slabId])
  }

  protected async duplicateSlab(slabId: number) {
    const [slab] = await db.execute<RowDataPacket[]>(
      `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
      [slabId],
    )
    if (slab.length > 1) {
      return
    }
    if (!slab || slab.length === 0) {
      return
    }
    const slabItem = slab[0]
    await db.execute<ResultSetHeader>(
      `INSERT INTO slab_inventory 
                (stone_id, bundle, length, width, url, parent_id) 
                VALUES (?, ?, ?, ?, ?, ?)`,
      [
        slabItem.stone_id,
        slabItem.bundle,
        slabItem.length,
        slabItem.width,
        slabItem.url,
        slabId,
      ],
    )
  }

  protected async deleteDuplicateSlab(slabId: number) {
    await db.execute(`DELETE FROM slab_inventory WHERE parent_id = ?`, [slabId])
  }

  async sell(user: User) {
    this.saleId = await this.createSale(user)
    for (const room of this.data.rooms) {
      const firstSlab = room.slabs[0]
      for (const slab of room.slabs) {
        await this.sellSlab(slab.id, room)

        if (!slab.is_full) {
          await this.duplicateSlab(slab.id)
        }
      }
      for (const sinkType of room.sink_type) {
        await this.sellSink(firstSlab.id, sinkType.type_id)
      }
      for (const faucetType of room.faucet_type) {
        await this.sellFaucet(firstSlab.id, faucetType.type_id)
      }
    }
    return this.saleId
  }

  async unsell() {
    if (!this.saleId) {
      throw new Error('Sale not found')
    }
    await this.deleteSale()
    for (const room of this.data.rooms) {
      for (const slab of room.slabs) {
        await this.unsellSlab(slab.id)
        await this.unsellSink(slab.id)
        await this.unsellFaucet(slab.id)
        if (!slab.is_full) {
          await this.deleteDuplicateSlab(slab.id)
        }
      }
    }
  }

  async edit(user: User) {
    if (!this.saleId) {
      throw new Error('Sale not found')
    }

    await this.updateSale(user)
    await this.unsellSlabs(this.saleId)

    for (const room of this.data.rooms) {
      const firstSlab = room.slabs[0]

      for (const slab of room.slabs) {
        await this.unsellSink(slab.id)
        await this.unsellFaucet(slab.id)

        await this.updateSlab(slab.id, room)

        const [hasChildren] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM slab_inventory WHERE parent_id = ?`,
          [slab.id],
        )

        if (!slab.is_full) {
          if (hasChildren.length === 0) {
            await this.duplicateSlab(slab.id)
          }
        } else {
          if (hasChildren.length > 0) {
            await this.deleteDuplicateSlab(slab.id)
          }
        }
      }

      // Sell sinks and faucets **once per room**, associated with the first slab
      for (const sinkType of room.sink_type) {
        await this.sellSink(firstSlab.id, sinkType.type_id)
      }
      for (const faucetType of room.faucet_type) {
        await this.sellFaucet(firstSlab.id, faucetType.type_id)
      }
    }
  }
}
