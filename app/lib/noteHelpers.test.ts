import type { Pool } from 'mysql2/promise'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseTestHelper, TestDataFactory } from '../../tests/testDatabase'
import { fetchNotesWithComments } from './noteHelpers.server'

// --- Helpers ---

function getDb(): Pool {
  return DatabaseTestHelper.connection as unknown as Pool
}

async function createNote(
  dealId: number,
  companyId: number,
  content: string,
  createdBy: string | null = null,
  createdAt?: string,
): Promise<number> {
  const conn = await DatabaseTestHelper.connect()
  const cols = createdAt
    ? '(deal_id, company_id, content, created_by, created_at)'
    : '(deal_id, company_id, content, created_by)'
  const placeholders = createdAt ? '(?, ?, ?, ?, ?)' : '(?, ?, ?, ?)'
  const params = createdAt
    ? [dealId, companyId, content, createdBy, createdAt]
    : [dealId, companyId, content, createdBy]

  const [result] = await conn.execute(
    `INSERT INTO deal_notes ${cols} VALUES ${placeholders}`,
    params,
  )
  return (result as { insertId: number }).insertId
}

async function togglePin(
  noteId: number,
  dealId: number,
  companyId: number,
): Promise<number> {
  const conn = await DatabaseTestHelper.connect()
  const [result] = await conn.execute(
    'UPDATE deal_notes SET is_pinned = NOT is_pinned WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [noteId, dealId, companyId],
  )
  return (result as { affectedRows: number }).affectedRows
}

async function deleteNote(
  noteId: number,
  dealId: number,
  companyId: number,
): Promise<void> {
  const conn = await DatabaseTestHelper.connect()
  await conn.execute(
    'UPDATE deal_notes SET deleted_at = NOW() WHERE id = ? AND deal_id = ? AND company_id = ?',
    [noteId, dealId, companyId],
  )
}

async function addComment(
  noteId: number,
  companyId: number,
  content: string,
  createdBy: string | null = null,
  createdAt?: string,
): Promise<number> {
  const conn = await DatabaseTestHelper.connect()
  const cols = createdAt
    ? '(note_id, company_id, content, created_by, created_at)'
    : '(note_id, company_id, content, created_by)'
  const placeholders = createdAt ? '(?, ?, ?, ?, ?)' : '(?, ?, ?, ?)'
  const params = createdAt
    ? [noteId, companyId, content, createdBy, createdAt]
    : [noteId, companyId, content, createdBy]

  const [result] = await conn.execute(
    `INSERT INTO deal_note_comments ${cols} VALUES ${placeholders}`,
    params,
  )
  return (result as { insertId: number }).insertId
}

async function updateNote(
  noteId: number,
  dealId: number,
  companyId: number,
  content: string,
): Promise<number> {
  const conn = await DatabaseTestHelper.connect()
  const [result] = await conn.execute(
    'UPDATE deal_notes SET content = ? WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [content, noteId, dealId, companyId],
  )
  return (result as { affectedRows: number }).affectedRows
}

async function deleteComment(commentId: number, companyId: number): Promise<void> {
  const conn = await DatabaseTestHelper.connect()
  await conn.execute(
    'UPDATE deal_note_comments SET deleted_at = NOW() WHERE id = ? AND company_id = ?',
    [commentId, companyId],
  )
}

async function seedDealsLists(
  conn: Awaited<ReturnType<typeof DatabaseTestHelper.connect>>,
) {
  await conn.execute(
    `INSERT INTO deals_list (id, name, position) VALUES
      (1, 'New Customers', 0),
      (2, 'Contacted', 1),
      (3, 'Got a Quote', 2),
      (4, 'Closed Won', 3),
      (5, 'Closed Lost', 4)`,
  )
}

async function createDeal(customerId: number, listId = 1): Promise<number> {
  return DatabaseTestHelper.insertTestData('deals', {
    customer_id: customerId,
    list_id: listId,
    position: 0,
  })
}

// --- Test Suite ---

describe('Notes CRUD Integration Tests', () => {
  let companyId: number
  let customerId: number
  let dealId: number

  beforeAll(async () => {
    await DatabaseTestHelper.createTestDatabase()
    const conn = await DatabaseTestHelper.connect()

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS company (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_date DATETIME
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255),
        password VARCHAR(255),
        is_employee TINYINT DEFAULT 0,
        is_admin TINYINT DEFAULT 0,
        is_superuser TINYINT DEFAULT 0,
        company_id INT,
        created_date DATETIME,
        FOREIGN KEY (company_id) REFERENCES company(id)
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        company_id INT,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        postal_code VARCHAR(20),
        created_date DATETIME,
        FOREIGN KEY (company_id) REFERENCES company(id)
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS deals_list (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        position INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS deals (
        id SERIAL PRIMARY KEY,
        customer_id INT NOT NULL,
        amount DECIMAL(10,2) NULL,
        description TEXT NULL,
        status VARCHAR(255) NULL,
        list_id INT NOT NULL,
        position INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        user_id INT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (list_id) REFERENCES deals_list(id)
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS deal_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        deal_id BIGINT UNSIGNED NOT NULL,
        company_id INT NOT NULL,
        content TEXT NOT NULL,
        is_pinned TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255) NULL,
        deleted_at DATETIME NULL,
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (company_id) REFERENCES company(id)
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS deal_note_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        note_id INT NOT NULL,
        company_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255) NULL,
        deleted_at DATETIME NULL,
        FOREIGN KEY (note_id) REFERENCES deal_notes(id),
        FOREIGN KEY (company_id) REFERENCES company(id)
      )
    `)

    await seedDealsLists(conn)
  })

  afterAll(async () => {
    await DatabaseTestHelper.disconnect()
  })

  beforeEach(async () => {
    await DatabaseTestHelper.clearAllTables()
    const conn = await DatabaseTestHelper.connect()
    await seedDealsLists(conn)

    companyId = await TestDataFactory.createTestCompany()
    customerId = await TestDataFactory.createTestCustomer(companyId)
    dealId = await createDeal(customerId)
  })

  // =============================================
  // Suite 1: fetchNotesWithComments basics
  // =============================================
  describe('fetchNotesWithComments', () => {
    it('should return empty array for deal with no notes', async () => {
      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toEqual([])
    })

    it('should return notes ordered by created_at DESC', async () => {
      await createNote(dealId, companyId, 'First note', null, '2024-01-01 10:00:00')
      await createNote(dealId, companyId, 'Second note', null, '2024-01-01 11:00:00')
      await createNote(dealId, companyId, 'Third note', null, '2024-01-01 12:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(3)
      expect(notes[0].content).toBe('Third note')
      expect(notes[1].content).toBe('Second note')
      expect(notes[2].content).toBe('First note')
    })

    it('should exclude soft-deleted notes', async () => {
      const noteA = await createNote(dealId, companyId, 'Keep me')
      const noteB = await createNote(dealId, companyId, 'Delete me')
      await deleteNote(noteB, dealId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(noteA)
      expect(notes[0].content).toBe('Keep me')
    })

    it('should return nested comments ordered by created_at ASC', async () => {
      const noteId = await createNote(dealId, companyId, 'Note with comments')
      await addComment(noteId, companyId, 'Comment 1', null, '2024-01-01 10:00:00')
      await addComment(noteId, companyId, 'Comment 2', null, '2024-01-01 11:00:00')
      await addComment(noteId, companyId, 'Comment 3', null, '2024-01-01 12:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].comments).toHaveLength(3)
      expect(notes[0].comments[0].content).toBe('Comment 1')
      expect(notes[0].comments[1].content).toBe('Comment 2')
      expect(notes[0].comments[2].content).toBe('Comment 3')
    })

    it('should exclude soft-deleted comments', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      await addComment(noteId, companyId, 'Keep this comment')
      const commentToDelete = await addComment(noteId, companyId, 'Delete this comment')
      await deleteComment(commentToDelete, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('Keep this comment')
    })

    it('should enforce multi-tenant isolation', async () => {
      const companyId2 = await TestDataFactory.createTestCompany()
      const customerId2 = await TestDataFactory.createTestCustomer(companyId2)
      const dealId2 = await createDeal(customerId2)

      await createNote(dealId, companyId, 'Company 1 note')
      await createNote(dealId2, companyId2, 'Company 2 note')

      const notes1 = await fetchNotesWithComments(getDb(), dealId, companyId)
      const notes2 = await fetchNotesWithComments(getDb(), dealId2, companyId2)

      expect(notes1).toHaveLength(1)
      expect(notes1[0].content).toBe('Company 1 note')
      expect(notes2).toHaveLength(1)
      expect(notes2[0].content).toBe('Company 2 note')
    })

    it('should return correct is_pinned status', async () => {
      const noteId = await createNote(dealId, companyId, 'Pinnable note')
      await togglePin(noteId, dealId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].is_pinned).toBe(1)
    })
  })

  // =============================================
  // Suite 2: Create note
  // =============================================
  describe('Create note', () => {
    it('should create a note and verify via fetch', async () => {
      await createNote(dealId, companyId, 'My new note')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('My new note')
      expect(notes[0].deal_id).toBe(dealId)
      expect(notes[0].company_id).toBe(companyId)
      expect(notes[0].is_pinned).toBe(0)
      expect(notes[0].comments).toEqual([])
    })

    it('should persist created_by for admin users', async () => {
      await createNote(dealId, companyId, 'Admin note', 'Admin User')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].created_by).toBe('Admin User')
    })

    it('should create multiple notes in correct order', async () => {
      await createNote(dealId, companyId, 'Note A', null, '2024-06-01 09:00:00')
      await createNote(dealId, companyId, 'Note B', null, '2024-06-01 10:00:00')
      await createNote(dealId, companyId, 'Note C', null, '2024-06-01 11:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(3)
      expect(notes[0].content).toBe('Note C')
      expect(notes[1].content).toBe('Note B')
      expect(notes[2].content).toBe('Note A')
    })
  })

  // =============================================
  // Suite 3: Update note
  // =============================================
  describe('Update note', () => {
    it('should update note content', async () => {
      const noteId = await createNote(dealId, companyId, 'Original content')
      const affected = await updateNote(noteId, dealId, companyId, 'Updated content')

      expect(affected).toBe(1)
      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].content).toBe('Updated content')
    })

    it('should not update a soft-deleted note', async () => {
      const noteId = await createNote(dealId, companyId, 'To delete')
      await deleteNote(noteId, dealId, companyId)

      const affected = await updateNote(noteId, dealId, companyId, 'Should not work')
      expect(affected).toBe(0)
    })

    it('should not update notes from another company', async () => {
      const companyId2 = await TestDataFactory.createTestCompany()
      const noteId = await createNote(dealId, companyId, 'Company 1 note')

      const affected = await updateNote(noteId, dealId, companyId2, 'Hacked')
      expect(affected).toBe(0)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].content).toBe('Company 1 note')
    })

    it('should preserve pin status and comments after update', async () => {
      const noteId = await createNote(dealId, companyId, 'Original')
      await togglePin(noteId, dealId, companyId)
      await addComment(noteId, companyId, 'A comment')

      await updateNote(noteId, dealId, companyId, 'Updated')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].content).toBe('Updated')
      expect(notes[0].is_pinned).toBe(1)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('A comment')
    })
  })

  // =============================================
  // Suite 4: Pin/unpin note
  // =============================================
  describe('Pin/unpin note', () => {
    it('should pin an unpinned note', async () => {
      const noteId = await createNote(dealId, companyId, 'Pin me')
      await togglePin(noteId, dealId, companyId)

      const rows = await DatabaseTestHelper.selectFromTable('deal_notes', {
        id: noteId,
      })
      expect(rows[0].is_pinned).toBe(1)
    })

    it('should unpin a pinned note (toggle)', async () => {
      const noteId = await createNote(dealId, companyId, 'Toggle me')
      await togglePin(noteId, dealId, companyId) // pin
      await togglePin(noteId, dealId, companyId) // unpin

      const rows = await DatabaseTestHelper.selectFromTable('deal_notes', {
        id: noteId,
      })
      expect(rows[0].is_pinned).toBe(0)
    })

    it('should not affect deleted notes', async () => {
      const noteId = await createNote(dealId, companyId, 'Deleted note')
      await deleteNote(noteId, dealId, companyId)

      const affectedRows = await togglePin(noteId, dealId, companyId)
      expect(affectedRows).toBe(0)
    })

    it('should pin multiple notes one by one without affecting others', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      const noteB = await createNote(dealId, companyId, 'Note B')
      const noteC = await createNote(dealId, companyId, 'Note C')

      // Pin A
      await togglePin(noteA, dealId, companyId)
      let rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(0)

      // Pin B
      await togglePin(noteB, dealId, companyId)
      rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(0)

      // Pin C
      await togglePin(noteC, dealId, companyId)
      rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(1)
    })

    it('should unpin multiple notes one by one without affecting others', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      const noteB = await createNote(dealId, companyId, 'Note B')
      const noteC = await createNote(dealId, companyId, 'Note C')

      // Pin all three
      await togglePin(noteA, dealId, companyId)
      await togglePin(noteB, dealId, companyId)
      await togglePin(noteC, dealId, companyId)

      // Unpin B only
      await togglePin(noteB, dealId, companyId)
      let rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(1)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(1)

      // Unpin A
      await togglePin(noteA, dealId, companyId)
      rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(1)
    })

    it('should handle interleaved pin/unpin across multiple notes', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      const noteB = await createNote(dealId, companyId, 'Note B')
      const noteC = await createNote(dealId, companyId, 'Note C')

      // Pin A, pin B, unpin A, pin C, unpin B
      await togglePin(noteA, dealId, companyId) // A=1, B=0, C=0
      await togglePin(noteB, dealId, companyId) // A=1, B=1, C=0
      await togglePin(noteA, dealId, companyId) // A=0, B=1, C=0
      await togglePin(noteC, dealId, companyId) // A=0, B=1, C=1
      await togglePin(noteB, dealId, companyId) // A=0, B=0, C=1

      const rows = await DatabaseTestHelper.selectFromTable('deal_notes')
      expect(rows.find(r => r.id === noteA)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteB)?.is_pinned).toBe(0)
      expect(rows.find(r => r.id === noteC)?.is_pinned).toBe(1)

      // Verify via fetch as well
      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      const fetchedA = notes.find(n => n.content === 'Note A')
      const fetchedB = notes.find(n => n.content === 'Note B')
      const fetchedC = notes.find(n => n.content === 'Note C')
      expect(fetchedA?.is_pinned).toBe(0)
      expect(fetchedB?.is_pinned).toBe(0)
      expect(fetchedC?.is_pinned).toBe(1)
    })
  })

  // =============================================
  // Suite 4: Delete note (soft delete)
  // =============================================
  describe('Delete note', () => {
    it('should set deleted_at on soft delete', async () => {
      const noteId = await createNote(dealId, companyId, 'Delete me')
      await deleteNote(noteId, dealId, companyId)

      const rows = await DatabaseTestHelper.selectFromTable('deal_notes', {
        id: noteId,
      })
      expect(rows[0].deleted_at).not.toBeNull()
    })

    it('should hide deleted note from fetchNotesWithComments', async () => {
      const noteA = await createNote(dealId, companyId, 'Keep')
      const noteB = await createNote(dealId, companyId, 'Remove')
      await deleteNote(noteB, dealId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(noteA)
    })

    it('should hide comments of deleted note from fetch', async () => {
      const noteId = await createNote(dealId, companyId, 'Note with comments')
      await addComment(noteId, companyId, 'Comment on deleted note')
      await deleteNote(noteId, dealId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(0)
    })
  })

  // =============================================
  // Suite 5: Add comment
  // =============================================
  describe('Add comment', () => {
    it('should add a comment to an existing note', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      await addComment(noteId, companyId, 'My comment')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('My comment')
      expect(notes[0].comments[0].note_id).toBe(noteId)
    })

    it('should add multiple comments in correct order', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      await addComment(noteId, companyId, 'First', null, '2024-01-01 08:00:00')
      await addComment(noteId, companyId, 'Second', null, '2024-01-01 09:00:00')
      await addComment(noteId, companyId, 'Third', null, '2024-01-01 10:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(3)
      expect(notes[0].comments[0].content).toBe('First')
      expect(notes[0].comments[1].content).toBe('Second')
      expect(notes[0].comments[2].content).toBe('Third')
    })

    it('should persist created_by on comment', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      await addComment(noteId, companyId, 'Admin comment', 'Admin User')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments[0].created_by).toBe('Admin User')
    })
  })

  // =============================================
  // Suite 6: Delete comment (soft delete)
  // =============================================
  describe('Delete comment', () => {
    it('should set deleted_at on comment', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      const commentId = await addComment(noteId, companyId, 'Delete me')
      await deleteComment(commentId, companyId)

      const rows = await DatabaseTestHelper.selectFromTable('deal_note_comments', {
        id: commentId,
      })
      expect(rows[0].deleted_at).not.toBeNull()
    })

    it('should hide deleted comment from fetch', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      await addComment(noteId, companyId, 'Keep')
      const commentToDelete = await addComment(noteId, companyId, 'Remove')
      await deleteComment(commentToDelete, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('Keep')
    })

    it('should not affect the parent note', async () => {
      const noteId = await createNote(dealId, companyId, 'My note')
      const commentId = await addComment(noteId, companyId, 'Remove me')
      await deleteComment(commentId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('My note')
      expect(notes[0].is_pinned).toBe(0)
      expect(notes[0].comments).toHaveLength(0)
    })

    it('should not affect comments on other notes', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      const noteB = await createNote(dealId, companyId, 'Note B')
      await addComment(noteA, companyId, 'A comment')
      const toDelete = await addComment(noteB, companyId, 'B comment to delete')
      await addComment(noteB, companyId, 'B comment to keep')

      await deleteComment(toDelete, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      const a = notes.find(n => n.content === 'Note A')
      const b = notes.find(n => n.content === 'Note B')
      expect(a?.comments).toHaveLength(1)
      expect(a?.comments[0].content).toBe('A comment')
      expect(b?.comments).toHaveLength(1)
      expect(b?.comments[0].content).toBe('B comment to keep')
    })

    it('should not affect pin status of the parent note', async () => {
      const noteId = await createNote(dealId, companyId, 'Pinned note')
      await togglePin(noteId, dealId, companyId)
      const commentId = await addComment(noteId, companyId, 'Temp')
      await deleteComment(commentId, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].is_pinned).toBe(1)
      expect(notes[0].comments).toHaveLength(0)
    })

    it('should delete multiple comments one by one without affecting others', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      const c1 = await addComment(
        noteId,
        companyId,
        'Comment 1',
        null,
        '2024-01-01 08:00:00',
      )
      const c2 = await addComment(
        noteId,
        companyId,
        'Comment 2',
        null,
        '2024-01-01 09:00:00',
      )
      const c3 = await addComment(
        noteId,
        companyId,
        'Comment 3',
        null,
        '2024-01-01 10:00:00',
      )

      // Delete c2 first
      await deleteComment(c2, companyId)
      let notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(2)
      expect(notes[0].comments[0].content).toBe('Comment 1')
      expect(notes[0].comments[1].content).toBe('Comment 3')

      // Delete c1
      await deleteComment(c1, companyId)
      notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('Comment 3')

      // Delete c3
      await deleteComment(c3, companyId)
      notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(0)
    })

    it('should allow adding comments after deleting one', async () => {
      const noteId = await createNote(dealId, companyId, 'Note')
      const c1 = await addComment(
        noteId,
        companyId,
        'First',
        null,
        '2024-01-01 08:00:00',
      )
      await deleteComment(c1, companyId)
      await addComment(noteId, companyId, 'Second', null, '2024-01-01 09:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('Second')
    })

    it('should not affect other deals or companies', async () => {
      const companyId2 = await TestDataFactory.createTestCompany()
      const customerId2 = await TestDataFactory.createTestCustomer(companyId2)
      const dealId2 = await createDeal(customerId2)

      const note1 = await createNote(dealId, companyId, 'Note C1')
      const note2 = await createNote(dealId2, companyId2, 'Note C2')
      await addComment(note1, companyId, 'C1 comment')
      const toDelete = await addComment(note2, companyId2, 'C2 comment')

      await deleteComment(toDelete, companyId2)

      const notes1 = await fetchNotesWithComments(getDb(), dealId, companyId)
      const notes2 = await fetchNotesWithComments(getDb(), dealId2, companyId2)
      expect(notes1[0].comments).toHaveLength(1)
      expect(notes1[0].comments[0].content).toBe('C1 comment')
      expect(notes2[0].comments).toHaveLength(0)
    })
  })

  // =============================================
  // Suite 7: Operation sequences
  // =============================================
  describe('Operation sequences', () => {
    it('Add -> Pin -> Delete -> Add: only new note visible', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      await togglePin(noteA, dealId, companyId)
      await deleteNote(noteA, dealId, companyId)
      await createNote(dealId, companyId, 'Note B')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('Note B')
      expect(notes[0].is_pinned).toBe(0)
    })

    it('Add -> Comment -> Delete comment -> Pin -> Add: 2 notes, first pinned with 0 comments', async () => {
      const noteA = await createNote(
        dealId,
        companyId,
        'Note A',
        null,
        '2024-01-01 10:00:00',
      )
      const comment = await addComment(noteA, companyId, 'Temp comment')
      await deleteComment(comment, companyId)
      await togglePin(noteA, dealId, companyId)
      await createNote(dealId, companyId, 'Note B', null, '2024-01-01 11:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(2)

      const pinned = notes.find(n => n.content === 'Note A')
      const unpinned = notes.find(n => n.content === 'Note B')
      expect(pinned).toBeDefined()
      expect(pinned?.is_pinned).toBe(1)
      expect(pinned?.comments).toHaveLength(0)
      expect(unpinned).toBeDefined()
      expect(unpinned?.is_pinned).toBe(0)
    })

    it('Add -> Add -> Pin first -> Delete second -> Comment on first -> Add third', async () => {
      const noteA = await createNote(
        dealId,
        companyId,
        'Note A',
        null,
        '2024-01-01 10:00:00',
      )
      const noteB = await createNote(
        dealId,
        companyId,
        'Note B',
        null,
        '2024-01-01 11:00:00',
      )
      await togglePin(noteA, dealId, companyId)
      await deleteNote(noteB, dealId, companyId)
      await addComment(noteA, companyId, 'Comment on A')
      await createNote(dealId, companyId, 'Note C', null, '2024-01-01 12:00:00')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(2)

      const a = notes.find(n => n.content === 'Note A')
      const c = notes.find(n => n.content === 'Note C')
      expect(a?.is_pinned).toBe(1)
      expect(a?.comments).toHaveLength(1)
      expect(a?.comments[0].content).toBe('Comment on A')
      expect(c?.is_pinned).toBe(0)
      expect(c?.comments).toHaveLength(0)

      // Note B should not appear
      expect(notes.find(n => n.content === 'Note B')).toBeUndefined()
    })

    it('Add -> Comment -> Comment -> Delete note -> Add -> Pin -> Comment', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      await addComment(noteA, companyId, 'C1 on A')
      await addComment(noteA, companyId, 'C2 on A')
      await deleteNote(noteA, dealId, companyId)

      const noteB = await createNote(dealId, companyId, 'Note B')
      await togglePin(noteB, dealId, companyId)
      await addComment(noteB, companyId, 'C3 on B')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('Note B')
      expect(notes[0].is_pinned).toBe(1)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('C3 on B')
    })

    it('Pin -> Unpin -> Delete -> Add -> Comment -> Delete comment -> Add comment', async () => {
      const noteA = await createNote(dealId, companyId, 'Note A')
      await togglePin(noteA, dealId, companyId) // pin
      await togglePin(noteA, dealId, companyId) // unpin
      await deleteNote(noteA, dealId, companyId)

      const noteB = await createNote(dealId, companyId, 'Note B')
      const c1 = await addComment(noteB, companyId, 'Temp comment')
      await deleteComment(c1, companyId)
      await addComment(noteB, companyId, 'Final comment')

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('Note B')
      expect(notes[0].is_pinned).toBe(0)
      expect(notes[0].comments).toHaveLength(1)
      expect(notes[0].comments[0].content).toBe('Final comment')
    })

    it('Multiple adds then bulk operations', async () => {
      const noteA = await createNote(
        dealId,
        companyId,
        'Note A',
        null,
        '2024-01-01 08:00:00',
      )
      const noteB = await createNote(
        dealId,
        companyId,
        'Note B',
        null,
        '2024-01-01 09:00:00',
      )
      const noteC = await createNote(
        dealId,
        companyId,
        'Note C',
        null,
        '2024-01-01 10:00:00',
      )
      const noteD = await createNote(
        dealId,
        companyId,
        'Note D',
        null,
        '2024-01-01 11:00:00',
      )

      // Pin B and D
      await togglePin(noteB, dealId, companyId)
      await togglePin(noteD, dealId, companyId)

      // Delete C
      await deleteNote(noteC, dealId, companyId)

      // Add comments: 2 on A, 1 on B
      await addComment(noteA, companyId, 'A comment 1', null, '2024-01-01 12:00:00')
      const commentToDelete = await addComment(
        noteA,
        companyId,
        'A comment 2',
        null,
        '2024-01-01 13:00:00',
      )
      await addComment(noteB, companyId, 'B comment 1')

      // Delete one comment on A
      await deleteComment(commentToDelete, companyId)

      const notes = await fetchNotesWithComments(getDb(), dealId, companyId)
      expect(notes).toHaveLength(3)

      // Verify by content (order is created_at DESC: D, B, A)
      const a = notes.find(n => n.content === 'Note A')
      const b = notes.find(n => n.content === 'Note B')
      const d = notes.find(n => n.content === 'Note D')

      expect(a).toBeDefined()
      expect(b).toBeDefined()
      expect(d).toBeDefined()
      expect(notes.find(n => n.content === 'Note C')).toBeUndefined()

      // A: 1 comment remaining, unpinned
      expect(a?.is_pinned).toBe(0)
      expect(a?.comments).toHaveLength(1)
      expect(a?.comments[0].content).toBe('A comment 1')

      // B: pinned, 1 comment
      expect(b?.is_pinned).toBe(1)
      expect(b?.comments).toHaveLength(1)
      expect(b?.comments[0].content).toBe('B comment 1')

      // D: pinned, 0 comments
      expect(d?.is_pinned).toBe(1)
      expect(d?.comments).toHaveLength(0)

      // Verify order: D (11:00), B (09:00), A (08:00) — DESC
      expect(notes[0].content).toBe('Note D')
      expect(notes[1].content).toBe('Note B')
      expect(notes[2].content).toBe('Note A')
    })

    it('Multi-tenant sequence isolation', async () => {
      // Setup second company
      const companyId2 = await TestDataFactory.createTestCompany()
      const customerId2 = await TestDataFactory.createTestCustomer(companyId2)
      const dealId2 = await createDeal(customerId2)

      // Operations on company 1
      const note1 = await createNote(dealId, companyId, 'Company1 note')
      await togglePin(note1, dealId, companyId)
      await addComment(note1, companyId, 'Company1 comment')

      // Operations on company 2
      const note2 = await createNote(dealId2, companyId2, 'Company2 note')
      await addComment(note2, companyId2, 'Company2 comment')

      // Verify isolation
      const notes1 = await fetchNotesWithComments(getDb(), dealId, companyId)
      const notes2 = await fetchNotesWithComments(getDb(), dealId2, companyId2)

      expect(notes1).toHaveLength(1)
      expect(notes1[0].content).toBe('Company1 note')
      expect(notes1[0].is_pinned).toBe(1)
      expect(notes1[0].comments).toHaveLength(1)

      expect(notes2).toHaveLength(1)
      expect(notes2[0].content).toBe('Company2 note')
      expect(notes2[0].is_pinned).toBe(0)
      expect(notes2[0].comments).toHaveLength(1)

      // Delete note on company 1
      await deleteNote(note1, dealId, companyId)

      const notes1After = await fetchNotesWithComments(getDb(), dealId, companyId)
      const notes2After = await fetchNotesWithComments(getDb(), dealId2, companyId2)

      expect(notes1After).toHaveLength(0)
      expect(notes2After).toHaveLength(1) // unchanged
      expect(notes2After[0].content).toBe('Company2 note')
    })
  })
})
