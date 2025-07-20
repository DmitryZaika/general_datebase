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

  static async fromSalesId(salesId: number) {
    const data = await getCustomerSchemaFromSaleId(salesId)
    if (!data) {
      throw new Error('Sale not found')
    }
    return new Contract(data, salesId)
  }

  protected async verifyCustomer(user: User) {
    const [customerVerify] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM customers WHERE id = ? AND company_id = ?`,
      [this.data.customer_id, user.company_id],
    )

    if (!customerVerify || customerVerify.length === 0) {
      throw new Error('Customer not found')
    }
  }

  protected async updateCustomer(user: User) {
    if (!this.data.customer_id) return

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT address, phone, email, company_name FROM customers WHERE id = ? AND company_id = ?`,
      [this.data.customer_id, user.company_id],
    )

    if (!rows || rows.length === 0) {
      throw new Error('Customer not found')
    }

    const current = rows[0]
    const updateFields: string[] = []
    const updateValues: (string | null)[] = []

    if (
      this.data.company_name &&
      (!current.company_name || current.company_name === null)
    ) {
      updateFields.push('company_name = ?')
      updateValues.push(this.data.company_name)
    }

    if (this.data.billing_address && (!current.address || current.address === '')) {
      updateFields.push('address = ?')
      updateValues.push(this.data.billing_address)
    }

    if (this.data.phone && (!current.phone || current.phone === '')) {
      updateFields.push('phone = ?')
      updateValues.push(this.data.phone)
    }

    if (this.data.email && (!current.email || current.email === '')) {
      updateFields.push('email = ?')
      updateValues.push(this.data.email)
    }

    if (updateFields.length > 0) {
      await db.execute(
        `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ? AND company_id = ?`,
        [...updateValues, this.data.customer_id, user.company_id],
      )
    }
  }

  protected async createCustomer(user: User) {
    const [customerResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO customers (name, company_id, phone, email, address, postal_code) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        this.data.name,
        user.company_id,
        this.data.phone || null,
        this.data.email || null,
        this.data.billing_address || null,
        this.data.billing_zip_code || null,
      ],
    )
    return customerResult.insertId
  }

  protected async createSale(user: User, customerId: number) {
    const totalSquareFeet = await this.calculateTotalSquareFeet()
    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price, project_address) 
               VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?, ?)`,
      [
        customerId,
        user.id,
        user.company_id,
        this.data.notes_to_sale || null,
        totalSquareFeet,
        this.data.price || 0,
        this.data.project_address || this.data.billing_address,
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
      `UPDATE slab_inventory SET room_uuid = UUID_TO_BIN(?), seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?, stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ?, sale_id = ? WHERE id = ?`,
      [
        room.room_id,
        room.seam,
        room.edge,
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

  protected async updateSale(user: User, customerId: number) {
    if (this.saleId === null) {
      throw new Error('Sale not found')
    }
    const totalSquareFeet = await this.calculateTotalSquareFeet()
    await db.execute(
      `UPDATE sales SET customer_id = ?, seller_id = ?, notes = ?, square_feet = ?, price = ?, project_address = ? WHERE id = ? AND company_id = ?`,
      [
        customerId,
        user.id,
        this.data.notes_to_sale || null,
        totalSquareFeet,
        this.data.price || 0,
        this.data.project_address || this.data.billing_address,
        this.saleId,
        user.company_id,
      ],
    )
  }

  protected async updateCompanyName(customerId: number, user: User) {
    await db.execute(
      `UPDATE customers SET company_name = ? WHERE id = ? AND company_id = ?`,
      [this.data.company_name, customerId, user.company_id],
    )
  }

  protected async calculateTotalSquareFeet() {
    return this.data.rooms.reduce((sum, room) => sum + (room.square_feet || 0), 0)
  }

  protected async sellSlab(slabId: number, room: TRoomSchema) {
    await db.execute(
      `UPDATE slab_inventory SET sale_id = ?, room_uuid = UUID_TO_BIN(?), seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ? WHERE id = ?`,
      [
        this.saleId,
        room.room_id,
        room.seam,
        room.edge,
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
      `UPDATE slab_inventory SET sale_id = NULL, room_uuid = NULL, seam = NULL, edge = NULL, room = NULL, backsplash = NULL, tear_out = NULL, square_feet = NULL,
            stove = NULL, ten_year_sealer = NULL, waterfall = NULL, corbels = NULL, price = NULL, extras = NULL WHERE id = ?`,
      [slabId],
    )
  }

  protected async unsellSlabs(saleId: number) {
    await db.execute(
      `UPDATE slab_inventory SET sale_id = NULL, room_uuid = NULL, seam = NULL, edge = NULL, room = NULL, backsplash = NULL, tear_out = NULL, square_feet = NULL,
          stove = NULL, ten_year_sealer = NULL, waterfall = NULL, corbels = NULL, price = NULL, extras = NULL WHERE sale_id = ?`,
      [saleId],
    )
  }

  protected async sellSink(slabId: number, sinkTypeId: number) {
    await db.execute(
      `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
      [slabId, sinkTypeId],
    )
  }

  protected async unsellSink(slabId: number) {
    await db.execute(`UPDATE sinks SET slab_id = NULL WHERE slab_id = ?`, [slabId])
  }

  protected async sellFaucet(slabId: number, faucetTypeId: number) {
    await db.execute(
      `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
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
    let customerId: number
    if (this.data.customer_id) {
      await this.verifyCustomer(user)
      customerId = this.data.customer_id
    } else {
      customerId = await this.createCustomer(user)
    }
    await this.updateCompanyName(customerId, user)

    this.saleId = await this.createSale(user, customerId)
    for (const room of this.data.rooms) {
      const firstSlab = room.slabs[0]
      for (const slab of room.slabs) {
        this.sellSlab(slab.id, room)

        if (!slab.is_full) {
          this.duplicateSlab(slab.id)
        }
      }
      for (const sinkType of room.sink_type) {
        this.sellSink(firstSlab.id, sinkType.id)
      }
      for (const faucetType of room.faucet_type) {
        this.sellFaucet(firstSlab.id, faucetType.id)
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
        this.unsellSlab(slab.id)
        this.unsellSink(slab.id)
        this.unsellFaucet(slab.id)
        if (!slab.is_full) {
          this.deleteDuplicateSlab(slab.id)
        }
      }
    }
  }

  async edit(user: User) {
    if (!this.saleId) {
      throw new Error('Sale not found')
    }

    let customerId: number
    if (this.data.customer_id) {
      await this.verifyCustomer(user)
      await this.updateCustomer(user)
      customerId = this.data.customer_id
    } else {
      customerId = await this.createCustomer(user)
    }

    await this.updateSale(user, customerId)

    await this.updateCompanyName(customerId, user)

    await this.unsellSlabs(this.saleId)

    for (const room of this.data.rooms) {
      for (const slab of room.slabs) {
        this.unsellSink(slab.id)
        this.unsellFaucet(slab.id)

        await this.updateSlab(slab.id, room)

        for (const sinkType of room.sink_type) {
          this.sellSink(slab.id, sinkType.id)
        }
        for (const faucetType of room.faucet_type) {
          this.sellFaucet(slab.id, faucetType.id)
        }

        const [hasChildren] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM slab_inventory WHERE parent_id = ?`,
          [slab.id],
        )

        if (!slab.is_full) {
          if (hasChildren.length === 0) {
            this.duplicateSlab(slab.id)
          }
        } else {
          if (hasChildren.length > 0) {
            this.deleteDuplicateSlab(slab.id)
          }
        }
      }
    }
  }
}
