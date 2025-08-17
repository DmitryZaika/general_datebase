import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { User } from '~/utils/session.server'
import { DatabaseTestHelper, TestDataFactory } from '../../tests/testDatabase'
import { Contract } from './contract'

describe('Contract Integration Tests', () => {
  let user: User
  let companyId: number
  let customerId: number
  let stoneId: number
  let slabId: number
  let sinkTypeId: number
  let faucetTypeId: number

  beforeAll(async () => {
    // Set up test database
    await DatabaseTestHelper.createTestDatabase()
    await DatabaseTestHelper.runMigrations()
  })

  afterAll(async () => {
    await DatabaseTestHelper.disconnect()
  })

  beforeEach(async () => {
    // Clear all data before each test
    await DatabaseTestHelper.clearAllTables()

    // Create test data
    companyId = await TestDataFactory.createTestCompany()
    const userId = await TestDataFactory.createTestUser(companyId)
    customerId = await TestDataFactory.createTestCustomer(companyId)
    stoneId = await TestDataFactory.createTestStone(companyId)
    slabId = await TestDataFactory.createTestSlab(stoneId)
    sinkTypeId = await TestDataFactory.createTestSinkType(companyId)
    faucetTypeId = await TestDataFactory.createTestFaucetType(companyId)

    // Create sinks and faucets
    await TestDataFactory.createTestSink(sinkTypeId)
    await TestDataFactory.createTestFaucet(faucetTypeId)

    user = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      is_employee: true,
      is_admin: false,
      is_superuser: false,
      company_id: companyId,
    }
  })

  describe('Constructor', () => {
    it('should create a Contract instance with data and saleId', () => {
      const testData = TestDataFactory.createCustomerSchema()
      const contract = new Contract(testData, 123)

      expect(contract.data).toEqual(testData)
      expect(contract.saleId).toBe(123)
    })

    it('should create a Contract instance with default saleId of null', () => {
      const testData = TestDataFactory.createCustomerSchema()
      const contract = new Contract(testData)

      expect(contract.data).toEqual(testData)
      expect(contract.saleId).toBeNull()
    })
  })

  describe('sell', () => {
    it('should sell with existing customer', async () => {
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: true }],
            sink_type: [{ type_id: sinkTypeId }],
            faucet_type: [{ type_id: faucetTypeId }],
          }),
        ],
      })
      const contract = new Contract(customerData)

      await contract.sell(user)

      // Verify sale was created
      const sales = await DatabaseTestHelper.selectFromTable('sales', {
        customer_id: customerId,
      })
      expect(sales.length).toBe(1)
      expect(sales[0].seller_id).toBe(user.id)
      expect(sales[0].company_id).toBe(user.company_id)
      expect(sales[0].status).toBe('pending')

      // Verify slab was sold
      const slabs = await DatabaseTestHelper.selectFromTable('slab_inventory', {
        id: slabId,
      })
      expect(slabs[0].sale_id).toBe(sales[0].id)

      // Verify sink was sold
      const sinks = await DatabaseTestHelper.selectFromTable('sinks', {
        slab_id: slabId,
      })
      expect(sinks.length).toBe(1)

      // Verify faucet was sold
      const faucets = await DatabaseTestHelper.selectFromTable('faucets', {
        slab_id: slabId,
      })
      expect(faucets.length).toBe(1)
    })

    it('should sell with new customer', async () => {
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: undefined,
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: true }],
            sink_type: [{ type_id: sinkTypeId }],
            faucet_type: [{ type_id: faucetTypeId }],
          }),
        ],
      })
      const contract = new Contract(customerData)

      await contract.sell(user)

      // Verify new customer was created
      const customers = await DatabaseTestHelper.selectFromTable('customers', {
        customer_id: customerId,
      })
      expect(customers.length).toBe(2) // One from setup, one from sell

      // Verify sale was created
      const sales = await DatabaseTestHelper.selectFromTable('sales')
      expect(sales.length).toBe(1)
    })

    it('should duplicate partial slabs', async () => {
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: false }],
          }),
        ],
      })
      const contract = new Contract(customerData)

      await contract.sell(user)

      // Verify duplicate slab was created
      const slabs = await DatabaseTestHelper.selectFromTable('slab_inventory', {
        parent_id: slabId,
      })
      expect(slabs.length).toBe(1)
      expect(slabs[0].stone_id).toBe(stoneId)
    })

    it('should throw error when customer not found', async () => {
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: 99999,
      })
      const contract = new Contract(customerData)

      await expect(contract.sell(user)).rejects.toThrow('Customer not found')
    })
  })

  describe('unsell', () => {
    it('should unsell a sale', async () => {
      // First create a sale
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: false }],
            sink_type: [{ type_id: sinkTypeId }],
            faucet_type: [{ type_id: faucetTypeId }],
          }),
        ],
      })
      const contract = new Contract(customerData)
      const saleId = await contract.sell(user)
      // Create contract with sale ID and unsell
      const contractWithSale = await Contract.fromSalesId(saleId)
      await contractWithSale.unsell()

      // Verify sale was cancelled
      const updatedSales = await DatabaseTestHelper.selectFromTable('sales', {
        id: saleId,
      })
      expect(updatedSales[0].status).toBe('cancelled')
      expect(updatedSales[0].cancelled_date).not.toBeNull()

      // Verify slab was unsold
      const slabs = await DatabaseTestHelper.selectFromTable('slab_inventory', {
        id: slabId,
      })
      expect(slabs[0].sale_id).toBeNull()

      // Verify sink was unsold
      const sinks = await DatabaseTestHelper.selectFromTable('sinks', {
        slab_id: slabId,
      })
      expect(sinks.length).toBe(0)

      // Verify faucet was unsold
      const faucets = await DatabaseTestHelper.selectFromTable('faucets', {
        slab_id: slabId,
      })
      expect(faucets.length).toBe(0)

      // Verify duplicate slab was deleted
      const duplicateSlabs = await DatabaseTestHelper.selectFromTable(
        'slab_inventory',
        { parent_id: slabId },
      )
      expect(duplicateSlabs.length).toBe(0)
    })

    it('should throw error when saleId is null', async () => {
      const customerData = TestDataFactory.createCustomerSchema()
      const contract = new Contract(customerData, null)

      await expect(contract.unsell()).rejects.toThrow('Sale not found')
    })
  })

  describe('edit', () => {
    it('should edit an existing sale', async () => {
      // First create a sale
      const originalData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: true }],
            sink_type: [{ type_id: sinkTypeId }],
            faucet_type: [{ type_id: faucetTypeId }],
          }),
        ],
      })
      const contract = new Contract(originalData)
      await contract.sell(user)

      // Get the sale ID
      const sales = await DatabaseTestHelper.selectFromTable('sales', {
        customer_id: customerId,
      })
      const saleId = sales[0].id

      // Edit the sale
      const editedData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        price: 7500,
        notes_to_sale: 'Updated notes',
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: true }],
            sink_type: [{ type_id: sinkTypeId }],
            faucet_type: [{ type_id: faucetTypeId }],
            square_feet: 35,
          }),
        ],
      })
      const editContract = new Contract(editedData, saleId)
      await editContract.edit(user)

      // Verify sale was updated
      const updatedSales = await DatabaseTestHelper.selectFromTable('sales', {
        id: saleId,
      })
      expect(updatedSales[0].price).toBe('7500.00')
      expect(updatedSales[0].notes).toBe('Updated notes')
      expect(updatedSales[0].square_feet).toBe('35.00')

      // Verify slab was updated
      const slabs = await DatabaseTestHelper.selectFromTable('slab_inventory', {
        id: slabId,
      })
      expect(slabs[0].square_feet).toBe('35.00')
    })

    it('should throw error when saleId is null', async () => {
      const customerData = TestDataFactory.createCustomerSchema()
      const contract = new Contract(customerData, null)

      await expect(contract.edit(user)).rejects.toThrow('Sale not found')
    })
  })

  describe('fromSalesId', () => {
    it('should create Contract from existing sale', async () => {
      // Create a sale first
      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
      })
      const contract = new Contract(customerData)
      await contract.sell(user)

      // Find the created sale
      const sales = await DatabaseTestHelper.selectFromTable('sales', {
        customer_id: customerId,
      })
      expect(sales.length).toBe(1)
      const saleId = sales[0].id

      // Test fromSalesId
      const result = await Contract.fromSalesId(saleId)
      expect(result.saleId).toBe(saleId)
      expect(result.data.customer_id).toBe(customerId)
    })

    it('should throw error when sale not found', async () => {
      await expect(Contract.fromSalesId(99999)).rejects.toThrow('Sale not found')
    })
  })

  describe('Error handling', () => {
    it('should handle customer from different company', async () => {
      // Create customer in different company
      const otherCompanyId = await TestDataFactory.createTestCompany()
      const otherCustomerId = await TestDataFactory.createTestCustomer(otherCompanyId)

      const customerData = TestDataFactory.createCustomerSchema({
        customer_id: otherCustomerId,
      })
      const contract = new Contract(customerData)

      await expect(contract.sell(user)).rejects.toThrow('Customer not found')
    })

    it('should handle builder customers', async () => {
      const builderData = TestDataFactory.createCustomerSchema({
        customer_id: customerId,
        company_name: 'Builder Company Inc',
        rooms: [
          TestDataFactory.createRoom({
            slabs: [{ id: slabId, is_full: true }],
          }),
        ],
      })
      const contract = new Contract(builderData)
      await contract.sell(user)

      // Verify customer company name was set
      const customers = await DatabaseTestHelper.selectFromTable('customers', {
        id: customerId,
      })
      expect(customers[0].company_name).toBe('Builder Company Inc')
    })
  })
})
