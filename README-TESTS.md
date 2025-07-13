# Database Integration Tests

This project includes comprehensive integration tests for the Contract class that run against a real MySQL database instead of mocks.

## Setup

### Prerequisites

1. **MySQL Database**: You need access to a MySQL database server
2. **Environment Variables**: Set up your database connection in `.env`:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database_name
```

### Test Database

The tests automatically create a test database named `{DB_DATABASE}_test` to avoid affecting your development data.

**Important**: The test database will be **completely wiped** before each test run, so never use a production database!

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Only Contract Tests
```bash
npm test -- app/orm/contract.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

## Test Structure

### DatabaseTestHelper

A utility class that provides:
- `createTestDatabase()`: Creates a fresh test database
- `runMigrations()`: Runs all SQL migrations
- `clearAllTables()`: Clears all data between tests
- `insertTestData()`: Inserts test data into tables
- `selectFromTable()`: Queries data from tables

### TestDataFactory

Factory methods for creating test data:
- `createUser()`: Creates test user objects
- `createCustomerSchema()`: Creates customer schema for Contract
- `createTestCompany()`: Inserts test company into database
- `createTestCustomer()`: Inserts test customer into database
- `createTestStone()`: Inserts test stone into database
- `createTestSlab()`: Inserts test slab into database
- And more...

## Test Coverage

The tests cover all Contract class methods:

### Constructor & Static Methods
- ✅ Constructor with/without saleId
- ✅ `fromSalesId()` - loading from existing sale
- ✅ Error handling for missing sales

### Core Business Operations
- ✅ `sell()` - Creating new sales with existing/new customers
- ✅ `unsell()` - Cancelling sales and reversing all changes
- ✅ `edit()` - Modifying existing sales

### Customer Management
- ✅ Customer verification and validation
- ✅ Creating new customers vs updating existing ones
- ✅ Handling builder customers with company names
- ✅ Updating customer information from contracts

### Product Management
- ✅ Selling slabs, sinks, and faucets
- ✅ Handling partial vs full slabs
- ✅ Slab duplication for partial slabs
- ✅ Unselling and cleanup operations

### Error Handling
- ✅ Invalid customer IDs
- ✅ Customers from different companies
- ✅ Missing sales for edit/unsell operations
- ✅ Database constraint violations

## Key Features

1. **Real Database Operations**: All tests run actual SQL queries against a MySQL database
2. **Complete Isolation**: Each test starts with a clean database state
3. **Migration Support**: Automatically runs all migrations before testing
4. **Data Integrity**: Verifies actual database state after operations
5. **Comprehensive Coverage**: Tests all methods and edge cases

## Performance

- Tests run in single-threaded mode for database consistency
- Each test gets a fresh database state (takes ~100-500ms per test)
- Total test suite runs in ~10-30 seconds depending on database speed

## Troubleshooting

### Database Connection Issues
- Ensure MySQL is running and accessible
- Check environment variables are set correctly
- Verify database user has CREATE/DROP permissions

### Migration Errors
- Ensure all migration files are present in `/migrations`
- Check migration SQL syntax
- Verify database permissions for schema changes

### Test Failures
- Check if test database was properly created
- Verify all required tables exist after migrations
- Look for foreign key constraint violations

## Example Test

```javascript
it('should sell with existing customer', async () => {
  const customerData = TestDataFactory.createCustomerSchema({ 
    customer_id: customerId,
    rooms: [TestDataFactory.createRoom({
      slabs: [{ id: slabId, is_full: true }],
      sink_type: [{ id: sinkTypeId }],
      faucet_type: [{ id: faucetTypeId }],
    })],
  })
  const contract = new Contract(customerData)
  
  await contract.sell(user)
  
  // Verify sale was created
  const sales = await DatabaseTestHelper.selectFromTable('sales', { customer_id: customerId })
  expect(sales.length).toBe(1)
  expect(sales[0].seller_id).toBe(user.id)
  
  // Verify slab was sold
  const slabs = await DatabaseTestHelper.selectFromTable('slab_inventory', { id: slabId })
  expect(slabs[0].sale_id).toBe(sales[0].id)
})
```

This approach ensures your tests reflect real-world database behavior and catch integration issues that mocks might miss. 