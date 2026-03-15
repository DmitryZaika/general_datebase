import type { ResultSetHeader } from 'mysql2'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { data, redirect } from 'react-router'
import { db } from '~/db.server'
import { notifyDealAssignee } from '~/lib/dealNotification.server'
import { fetchNotesWithComments } from '~/lib/noteHelpers.server'
import type { Nullable } from '~/types/utils'
import {
  badRequest,
  handleAuthError,
  notFound,
  success,
} from '~/utils/apiResponse.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export interface DealNoteComment {
  id: number
  note_id: number
  content: string
  created_at: string
  created_by: Nullable<string>
}

export interface DealNote {
  id: number
  deal_id: number
  company_id: number
  content: string
  is_pinned: 0 | 1
  created_at: string
  created_by: Nullable<string>
  comments: DealNoteComment[]
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    const dealId = parseInt(params.dealId || '0', 10)

    if (!dealId) {
      return data({ notes: [], error: 'Invalid deal ID' }, { status: 400 })
    }

    const notes = await fetchNotesWithComments(db, dealId, user.company_id)
    return data({ notes, error: null })
  } catch (error) {
    if (error instanceof TypeError) {
      return redirect('/login')
    }
    return data({ notes: [], error: 'Failed to load notes' }, { status: 500 })
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  try {
    await csrf.validate(request)
  } catch {
    return badRequest('Invalid CSRF token')
  }

  try {
    const user = await getEmployeeUser(request)
    const dealId = parseInt(params.dealId || '0', 10)

    if (!dealId) {
      return badRequest('Invalid deal ID')
    }

    const formData = await request.formData()
    const intent = formData.get('intent')

    if (intent === 'create') {
      const createdBy = user.is_admin || user.is_superuser ? user.name : null
      return handleCreate(formData, dealId, user.company_id, createdBy, user.id)
    }

    if (intent === 'pin') {
      return handlePin(formData, dealId, user.company_id)
    }

    if (intent === 'update') {
      const createdBy = user.is_admin || user.is_superuser ? user.name : null
      return handleUpdate(formData, dealId, user.company_id, createdBy, user.id)
    }

    if (intent === 'delete') {
      return handleDelete(formData, dealId, user.company_id, user)
    }

    if (intent === 'add-comment') {
      const createdBy = user.is_admin || user.is_superuser ? user.name : null
      return handleAddComment(formData, dealId, user.company_id, createdBy, user.id)
    }

    if (intent === 'delete-comment') {
      return handleDeleteComment(formData, dealId, user.company_id, user)
    }

    return badRequest('Unknown action intent')
  } catch (error) {
    return handleAuthError(error)
  }
}

async function handleCreate(
  formData: FormData,
  dealId: number,
  companyId: number,
  createdBy: Nullable<string>,
  userId: number,
) {
  const content = formData.get('content')

  if (!content || typeof content !== 'string' || !content.trim()) {
    return badRequest('Note content is required')
  }

  if (content.trim().length > 5000) {
    return badRequest('Note content must be 5000 characters or less')
  }

  const dealRows = await selectMany<{ id: number }>(
    db,
    `SELECT d.id FROM deals d
     JOIN customers c ON d.customer_id = c.id
     WHERE d.id = ? AND c.company_id = ? AND d.deleted_at IS NULL`,
    [dealId, companyId],
  )
  if (!dealRows.length) {
    return notFound('Deal not found')
  }

  await db.execute<ResultSetHeader>(
    `INSERT INTO deal_notes (deal_id, company_id, content, created_by)
     VALUES (?, ?, ?, ?)`,
    [dealId, companyId, content.trim(), createdBy],
  )

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      content.trim(),
      'note_added',
    )
  }

  return success()
}

async function handleUpdate(
  formData: FormData,
  dealId: number,
  companyId: number,
  createdBy: Nullable<string>,
  userId: number,
) {
  const noteId = formData.get('noteId')
  const content = formData.get('content')

  if (!noteId || Number.isNaN(Number(noteId))) {
    return badRequest('Valid note ID is required')
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return badRequest('Note content is required')
  }

  if (content.trim().length > 5000) {
    return badRequest('Note content must be 5000 characters or less')
  }

  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE deal_notes SET content = ? WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [content.trim(), Number(noteId), dealId, companyId],
  )

  if (result.affectedRows === 0) {
    return notFound('Note not found')
  }

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      content.trim(),
      'note_edited',
    )
  }

  return success()
}

async function handlePin(formData: FormData, dealId: number, companyId: number) {
  const noteId = formData.get('noteId')

  if (!noteId || Number.isNaN(Number(noteId))) {
    return badRequest('Valid note ID is required')
  }

  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE deal_notes SET is_pinned = NOT is_pinned WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(noteId), dealId, companyId],
  )

  if (result.affectedRows === 0) {
    return notFound('Note not found')
  }

  return success()
}

type UserForDelete = {
  id: number
  name: string
  is_admin: boolean
  is_superuser: boolean
}

async function handleDelete(
  formData: FormData,
  dealId: number,
  companyId: number,
  user: UserForDelete,
) {
  const noteId = formData.get('noteId')

  if (!noteId || Number.isNaN(Number(noteId))) {
    return badRequest('Valid note ID is required')
  }

  const rows = await selectMany<{
    id: number
    content: string
    created_by: Nullable<string>
  }>(
    db,
    'SELECT id, content, created_by FROM deal_notes WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(noteId), dealId, companyId],
  )

  if (!rows.length) {
    return notFound('Note not found')
  }

  if (!user.is_admin && !user.is_superuser) {
    return data({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  await db.execute(
    'UPDATE deal_notes SET deleted_at = NOW() WHERE id = ? AND deal_id = ? AND company_id = ?',
    [Number(noteId), dealId, companyId],
  )

  if (user.is_admin || user.is_superuser) {
    await notifyDealAssignee(
      db,
      dealId,
      user.id,
      user.name,
      rows[0].content,
      'note_deleted',
    )
  }

  return success()
}

async function handleAddComment(
  formData: FormData,
  dealId: number,
  companyId: number,
  createdBy: Nullable<string>,
  userId: number,
) {
  const noteId = formData.get('noteId')
  const content = formData.get('content')

  if (!noteId || Number.isNaN(Number(noteId))) {
    return badRequest('Valid note ID is required')
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return badRequest('Comment content is required')
  }

  if (content.trim().length > 2000) {
    return badRequest('Comment must be 2000 characters or less')
  }

  const rows = await selectMany<{ id: number }>(
    db,
    'SELECT id FROM deal_notes WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(noteId), dealId, companyId],
  )

  if (!rows.length) {
    return notFound('Note not found')
  }

  await db.execute<ResultSetHeader>(
    `INSERT INTO deal_note_comments (note_id, company_id, content, created_by)
     VALUES (?, ?, ?, ?)`,
    [Number(noteId), companyId, content.trim(), createdBy],
  )

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      content.trim(),
      'comment_added',
    )
  }

  return success()
}

async function handleDeleteComment(
  formData: FormData,
  dealId: number,
  companyId: number,
  user: UserForDelete,
) {
  if (!user.is_admin && !user.is_superuser) {
    return data({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const commentId = formData.get('commentId')

  if (!commentId || Number.isNaN(Number(commentId))) {
    return badRequest('Valid comment ID is required')
  }

  const rows = await selectMany<{ id: number; content: string }>(
    db,
    `SELECT dnc.id, dnc.content
     FROM deal_note_comments dnc
     JOIN deal_notes dn ON dnc.note_id = dn.id
     WHERE dnc.id = ? AND dnc.company_id = ? AND dn.deal_id = ?
       AND dnc.deleted_at IS NULL AND dn.deleted_at IS NULL`,
    [Number(commentId), companyId, dealId],
  )

  if (!rows.length) {
    return notFound('Comment not found')
  }

  await db.execute(
    'UPDATE deal_note_comments SET deleted_at = NOW() WHERE id = ? AND company_id = ?',
    [Number(commentId), companyId],
  )

  if (user.is_admin || user.is_superuser) {
    await notifyDealAssignee(
      db,
      dealId,
      user.id,
      user.name,
      rows[0].content,
      'comment_deleted',
    )
  }

  return success()
}
