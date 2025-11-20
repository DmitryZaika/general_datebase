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
      `SELECT address FROM customers WHERE id = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1`,
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

    await db.execute(
      `UPDATE customers
         SET sales_rep = COALESCE(sales_rep, ?)
       WHERE id = ? AND company_id = ?`,
      [user.id, this.data.customer_id, user.company_id],
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
      `UPDATE sales
         SET customer_id = ?,
             seller_id = COALESCE(?, seller_id),
             notes = ?,
             square_feet = ?,
             price = ?,
             project_address = ?,
             extras = ?
       WHERE id = ? AND company_id = ?`,
      [
        this.data.customer_id,
        this.data.seller_id ?? null,
        this.data.notes_to_sale || null,
        totalSquareFeet,
        this.data.price || 0,
        this.data.project_address || (await this.getCustomerAddress(user)),
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

  protected async sellSink(slabId: number, sinkTypeId: number, price: number) {
    // Check if there's an available sink of this type
    const [available] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM sinks WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
      [sinkTypeId],
    )

    if (!available || available.length === 0) {
      throw new Error(
        `No available sinks of type ${sinkTypeId}. Cannot complete the sale.`,
      )
    }

    await db.execute(
      `UPDATE sinks SET slab_id = ? , price = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 ORDER BY id LIMIT 1`,
      [slabId, price, sinkTypeId],
    )
  }
  protected async unsellSink(slabId: number) {
    await db.execute(
      `UPDATE sinks SET slab_id = NULL, price = NULL WHERE slab_id = ?`,
      [slabId],
    )
  }

  protected async sellFaucet(slabId: number, faucetTypeId: number, price: number) {
    // Check if there's an available faucet of this type
    const [available] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM faucets WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
      [faucetTypeId],
    )

    if (!available || available.length === 0) {
      throw new Error(
        `No available faucets of type ${faucetTypeId}. Cannot complete the sale.`,
      )
    }

    await db.execute(
      `UPDATE faucets SET slab_id = ? , price = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 ORDER BY id LIMIT 1`,
      [slabId, price, faucetTypeId],
    )
  }

  protected async unsellFaucet(slabId: number) {
    await db.execute(
      `UPDATE faucets SET slab_id = NULL, price = NULL WHERE slab_id = ?`,
      [slabId],
    )
  }

  /**
   * Creates a child slab (copy) of the parent slab and returns the new ID
   * Used when a slab needs to be split (partial sales or multi-room usage)
   */
  protected async createChildSlab(parentSlabId: number): Promise<number> {
    const [slab] = await db.execute<RowDataPacket[]>(
      `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
      [parentSlabId],
    )
    if (slab.length === 0) {
      throw new Error(`Slab with id ${parentSlabId} not found`)
    }
    const slabItem = slab[0]
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO slab_inventory
                (stone_id, bundle, length, width, url, parent_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
      [
        slabItem.stone_id,
        slabItem.bundle,
        slabItem.length,
        slabItem.width,
        slabItem.url,
        parentSlabId,
      ],
    )
    return result.insertId
  }

  /**
   * Legacy method: creates a child slab for partial sales (is_full = false)
   * Calls createChildSlab but ignores the returned ID
   */
  protected async duplicateSlab(slabId: number) {
    const [slab] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM slab_inventory WHERE id = ?`,
      [slabId],
    )
    if (slab.length > 1 || slab.length === 0) {
      return
    }
    await this.createChildSlab(slabId)
  }

  protected async deleteDuplicateSlab(slabId: number) {
    await db.execute(`DELETE FROM slab_inventory WHERE parent_id = ?`, [slabId])
  }

  async sell(user: User) {
    this.saleId = await this.createSale(user)

    // Handle duplicate slabs: if a slab is used in multiple rooms, create child slabs
    const slabUsageMap = new Map<number, number>() // slabId -> usage count
    const slabReplacementMap = new Map<string, number>() // roomIndex-slabIndex -> new slabId

    // Count slab usage across all rooms
    this.data.rooms.forEach(room => {
      room.slabs.forEach(slab => {
        const count = slabUsageMap.get(slab.id) || 0
        slabUsageMap.set(slab.id, count + 1)
      })
    })

    // Create child slabs for duplicates
    for (let roomIndex = 0; roomIndex < this.data.rooms.length; roomIndex++) {
      const room = this.data.rooms[roomIndex]
      for (let slabIndex = 0; slabIndex < room.slabs.length; slabIndex++) {
        const slab = room.slabs[slabIndex]
        const usageCount = slabUsageMap.get(slab.id) || 0

        // If this slab is used more than once, we need child slabs
        if (usageCount > 1) {
          // Get current usage index for this slab
          const previousUsages = []
          for (let r = 0; r < roomIndex; r++) {
            previousUsages.push(
              ...this.data.rooms[r].slabs.filter(s => s.id === slab.id),
            )
          }
          for (let s = 0; s < slabIndex; s++) {
            if (room.slabs[s].id === slab.id) {
              previousUsages.push(room.slabs[s])
            }
          }

          // If this is not the first usage, create a child slab
          if (previousUsages.length > 0) {
            const childSlabId = await this.createChildSlab(slab.id)
            slabReplacementMap.set(`${roomIndex}-${slabIndex}`, childSlabId)
          }
        }
      }
    }

    // Now sell slabs with replacements applied
    for (let roomIndex = 0; roomIndex < this.data.rooms.length; roomIndex++) {
      const room = this.data.rooms[roomIndex]

      if (room.slabs.length === 0) {
        throw new Error(
          `Room ${roomIndex + 1} has no slabs. At least one slab is required per room.`,
        )
      }

      const firstSlab = room.slabs[0]
      const firstSlabId = slabReplacementMap.get(`${roomIndex}-0`) || firstSlab.id

      for (let slabIndex = 0; slabIndex < room.slabs.length; slabIndex++) {
        const slab = room.slabs[slabIndex]
        const actualSlabId =
          slabReplacementMap.get(`${roomIndex}-${slabIndex}`) || slab.id

        await this.sellSlab(actualSlabId, room)

        if (!slab.is_full) {
          await this.duplicateSlab(actualSlabId)
        }
      }

      for (const sinkType of room.sink_type) {
        await this.sellSink(firstSlabId, sinkType.type_id, sinkType.price)
      }
      for (const faucetType of room.faucet_type) {
        await this.sellFaucet(firstSlabId, faucetType.type_id, faucetType.price)
      }
    }
    return this.saleId
  }

  async unsell() {
    if (!this.saleId) {
      throw new Error('Sale not found')
    }
    await this.deleteSale()

    // First, unsell all slabs and their associated sinks/faucets
    for (const room of this.data.rooms) {
      for (const slab of room.slabs) {
        await this.unsellSlab(slab.id)
        await this.unsellSink(slab.id)
        await this.unsellFaucet(slab.id)
      }
    }

    // Then, delete child slabs (partial slabs)
    // We need to delete children after unselling to avoid deleting slabs before processing them
    for (const room of this.data.rooms) {
      for (const slab of room.slabs) {
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

    // Handle duplicate slabs: if a slab is used in multiple rooms, create child slabs
    const slabUsageMap = new Map<number, number>() // slabId -> usage count
    const slabReplacementMap = new Map<string, number>() // roomIndex-slabIndex -> new slabId

    // Count slab usage across all rooms
    this.data.rooms.forEach(room => {
      room.slabs.forEach(slab => {
        const count = slabUsageMap.get(slab.id) || 0
        slabUsageMap.set(slab.id, count + 1)
      })
    })

    // Create child slabs for duplicates
    for (let roomIndex = 0; roomIndex < this.data.rooms.length; roomIndex++) {
      const room = this.data.rooms[roomIndex]
      for (let slabIndex = 0; slabIndex < room.slabs.length; slabIndex++) {
        const slab = room.slabs[slabIndex]
        const usageCount = slabUsageMap.get(slab.id) || 0

        // If this slab is used more than once, we need child slabs
        if (usageCount > 1) {
          // Get current usage index for this slab
          const previousUsages = []
          for (let r = 0; r < roomIndex; r++) {
            previousUsages.push(
              ...this.data.rooms[r].slabs.filter(s => s.id === slab.id),
            )
          }
          for (let s = 0; s < slabIndex; s++) {
            if (room.slabs[s].id === slab.id) {
              previousUsages.push(room.slabs[s])
            }
          }

          // If this is not the first usage, create a child slab
          if (previousUsages.length > 0) {
            const childSlabId = await this.createChildSlab(slab.id)
            slabReplacementMap.set(`${roomIndex}-${slabIndex}`, childSlabId)
          }
        }
      }
    }

    // Now update slabs with replacements applied
    for (let roomIndex = 0; roomIndex < this.data.rooms.length; roomIndex++) {
      const room = this.data.rooms[roomIndex]

      if (room.slabs.length === 0) {
        throw new Error(
          `Room ${roomIndex + 1} has no slabs. At least one slab is required per room.`,
        )
      }

      const firstSlab = room.slabs[0]
      const firstSlabId = slabReplacementMap.get(`${roomIndex}-0`) || firstSlab.id

      for (let slabIndex = 0; slabIndex < room.slabs.length; slabIndex++) {
        const slab = room.slabs[slabIndex]
        const actualSlabId =
          slabReplacementMap.get(`${roomIndex}-${slabIndex}`) || slab.id

        await this.unsellSink(actualSlabId)
        await this.unsellFaucet(actualSlabId)

        await this.updateSlab(actualSlabId, room)

        const [hasChildren] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM slab_inventory WHERE parent_id = ?`,
          [actualSlabId],
        )

        if (!slab.is_full) {
          if (hasChildren.length === 0) {
            await this.duplicateSlab(actualSlabId)
          }
        } else {
          if (hasChildren.length > 0) {
            await this.deleteDuplicateSlab(actualSlabId)
          }
        }
      }

      // Sell sinks and faucets **once per room**, associated with the first slab
      for (const sinkType of room.sink_type) {
        await this.sellSink(firstSlabId, sinkType.type_id, sinkType.price)
      }
      for (const faucetType of room.faucet_type) {
        await this.sellFaucet(firstSlabId, faucetType.type_id, faucetType.price)
      }
    }
  }
}
