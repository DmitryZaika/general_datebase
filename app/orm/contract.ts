import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { db } from '~/db.server'
import { type TCustomerSchema, type TRoomSchema } from '~/schemas/sales'
import { type User } from '~/utils/session.server'


export class Contract {
    data: TCustomerSchema

    constructor(data: TCustomerSchema) {
        this.data = data
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
        const updateFields = []
        const updateValues = []
    
        if (
          this.data.billing_address &&
          (!this.data.billing_address || this.data.billing_address === '')
        ) {
          updateFields.push('address = ?')
          updateValues.push(this.data.billing_address)
        }
    
        if (this.data.phone && (!this.data.phone || this.data.phone === '')) {
          updateFields.push('phone = ?')
          updateValues.push(this.data.phone)
        }
    
        if (this.data.email && (!this.data.email || this.data.email === '')) {
          updateFields.push('email = ?')
          updateValues.push(this.data.email)
        }

        if ((this.data.builder && this.data.company_name) && (!this.data.company_name || this.data.company_name === '')) {
            updateFields.push('company_name = ?')
            updateValues.push(this.data.company_name)
        }
    
        if (updateFields.length > 0) {
          await db.execute(
            `UPDATE customers SET ${updateFields.join(
              ', ',
            )} WHERE id = ? AND company_id = ?`,
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

    protected async calculateTotalSquareFeet() {
        return this.data.rooms.reduce(
            (sum, room) => sum + (room.square_feet || 0),
            0,
          )
    }

    protected async sellSlab(saleId: number, slabId: number, room: TRoomSchema) {
        await db.execute(
            `UPDATE slab_inventory SET sale_id = ?, room_uuid = UUID_TO_BIN(?), seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ? WHERE id = ?`,
            [
              saleId,
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

    protected async sellSink(slabId: number, sinkTypeId: number) {
        await db.execute(
            `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
            [slabId, sinkTypeId],
          )
    }

    protected async sellFaucet(slabId: number, faucetTypeId: number) {
        await db.execute(
            `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
            [slabId, faucetTypeId],
          )
    }

    protected async duplicateSlab  (slabId: number) {
        const [slab] = await db.execute<RowDataPacket[]>(
            `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
            [slabId],
          )
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

    async sell(user: User) {
        let customerId: number
        if (this.data.customer_id) {
            await this.verifyCustomer(user)
            customerId = this.data.customer_id
        } else {
            customerId = await this.createCustomer(user)
        }

        const saleId = await this.createSale(user, customerId)
            for (const room of this.data.rooms) {
              for (const slab of room.slabs) {
                this.sellSlab(saleId, slab.id, room)
                for (const sinkType of room.sink_type) {
                    this.sellSink(slab.id, sinkType.id)
                }
                for (const faucetType of room.faucet_type) {
                    this.sellFaucet(slab.id, faucetType.id)
                }
                if (!slab.is_full) {
                    this.duplicateSlab(slab.id)
                }
              }
            }
          }

    async unsell(user: User) {
        console.log('Unselling')
    }

    async edit(user: User) {
        console.log('Editing')
    }
}

