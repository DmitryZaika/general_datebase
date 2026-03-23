import type { ResultSetHeader } from 'mysql2'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { data, redirect } from 'react-router'
import { db } from '~/db.server'
import {
  notifyDealAssignee,
  scheduleActivityDeadlineReminder,
} from '~/lib/dealNotification.server'
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

export enum ActivityPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface DealActivity {
  id: number
  deal_id: number
  company_id: number
  name: string
  deadline: Nullable<string>
  priority: ActivityPriority
  is_completed: number
  completed_at: Nullable<string>
  created_at: string
  created_by: Nullable<string>
}

const VALID_PRIORITIES = Object.values(ActivityPriority)

function isValidPriority(value: string): value is ActivityPriority {
  return VALID_PRIORITIES.includes(value as ActivityPriority)
}

function toMySQLDatetime(dateString: string): Nullable<string> {
  const full = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (full) {
    const [, y, mo, d, h, mi, s] = full
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`
  }
  const date = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (date) {
    const [, y, mo, d] = date
    return `${y}-${mo}-${d} 00:00:00`
  }
  return null
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    const dealId = parseInt(params.dealId || '0', 10)

    if (!dealId) {
      return data({ activities: [], error: 'Invalid deal ID' }, { status: 400 })
    }

    const activities = await selectMany<DealActivity>(
      db,
      `SELECT id, deal_id, company_id, name,
              DATE_FORMAT(deadline, '%Y-%m-%dT%H:%i:%sZ') AS deadline,
              priority, is_completed,
              DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completed_at,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
              created_by
       FROM deal_activities
       WHERE deal_id = ? AND company_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [dealId, user.company_id],
    )

    return data({ activities, error: null })
  } catch (error) {
    if (error instanceof TypeError) {
      return redirect('/login')
    }
    return data({ activities: [], error: 'Failed to load activities' }, { status: 500 })
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

    if (intent === 'toggle') {
      return handleToggle(formData, dealId, user.company_id)
    }

    if (intent === 'update') {
      const createdBy = user.is_admin || user.is_superuser ? user.name : null
      return handleUpdate(formData, dealId, user.company_id, createdBy, user.id)
    }

    if (intent === 'delete') {
      const createdBy = user.is_admin || user.is_superuser ? user.name : null
      return handleDelete(formData, dealId, user.company_id, createdBy, user.id)
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
  const name = formData.get('name')
  const deadline = formData.get('deadline')
  const priority = String(formData.get('priority') || ActivityPriority.Medium)

  if (!name || typeof name !== 'string' || !name.trim()) {
    return badRequest('Activity name is required')
  }

  if (name.trim().length > 255) {
    return badRequest('Activity name must be 255 characters or less')
  }

  if (!isValidPriority(priority)) {
    return badRequest(
      `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
    )
  }

  const rawDeadline =
    deadline && String(deadline).trim() ? String(deadline).trim() : null
  const deadlineValue: Nullable<string> = rawDeadline
    ? toMySQLDatetime(rawDeadline)
    : null

  if (rawDeadline && !deadlineValue) {
    return badRequest('Invalid deadline date format')
  }

  await db.execute<ResultSetHeader>(
    `INSERT INTO deal_activities (deal_id, company_id, name, deadline, priority, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [dealId, companyId, name.trim(), deadlineValue, priority, createdBy],
  )

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      name.trim(),
      'activity_added',
    )
  }

  const deadlineUtc = String(formData.get('deadlineUtc') || '').trim()
  if (deadlineUtc) {
    await scheduleActivityDeadlineReminder(db, dealId, userId, name.trim(), deadlineUtc)
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
  const activityId = formData.get('activityId')

  if (!activityId || Number.isNaN(Number(activityId))) {
    return badRequest('Valid activity ID is required')
  }

  const name = formData.get('name')
  const deadline = formData.get('deadline')
  const priority = String(formData.get('priority') || ActivityPriority.Medium)

  if (!name || typeof name !== 'string' || !name.trim()) {
    return badRequest('Activity name is required')
  }

  if (name.trim().length > 255) {
    return badRequest('Activity name must be 255 characters or less')
  }

  if (!isValidPriority(priority)) {
    return badRequest(
      `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
    )
  }

  const rows = await selectMany<{ id: number; name: string }>(
    db,
    'SELECT id, name FROM deal_activities WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(activityId), dealId, companyId],
  )

  if (!rows.length) {
    return notFound('Activity not found')
  }

  const oldName = rows[0].name

  const rawDeadline =
    deadline && String(deadline).trim() ? String(deadline).trim() : null
  const deadlineValue: Nullable<string> = rawDeadline
    ? toMySQLDatetime(rawDeadline)
    : null

  if (rawDeadline && !deadlineValue) {
    return badRequest('Invalid deadline date format')
  }

  await db.execute(
    `UPDATE deal_activities SET name = ?, deadline = ?, priority = ? WHERE id = ? AND deal_id = ? AND company_id = ?`,
    [name.trim(), deadlineValue, priority, Number(activityId), dealId, companyId],
  )

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      name.trim(),
      'activity_edited',
    )
  }

  const deadlineUtc = String(formData.get('deadlineUtc') || '').trim()
  if (deadlineUtc) {
    await scheduleActivityDeadlineReminder(
      db,
      dealId,
      userId,
      name.trim(),
      deadlineUtc,
      oldName,
    )
  }

  return success()
}

async function handleToggle(formData: FormData, dealId: number, companyId: number) {
  const activityId = formData.get('activityId')

  if (!activityId || Number.isNaN(Number(activityId))) {
    return badRequest('Valid activity ID is required')
  }

  const rows = await selectMany<{ is_completed: number }>(
    db,
    'SELECT is_completed FROM deal_activities WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(activityId), dealId, companyId],
  )

  if (!rows.length) {
    return notFound('Activity not found')
  }

  const newStatus = rows[0].is_completed ? 0 : 1

  await db.execute(
    `UPDATE deal_activities
     SET is_completed = ?, completed_at = ${newStatus ? 'NOW()' : 'NULL'}
     WHERE id = ? AND deal_id = ? AND company_id = ?`,
    [newStatus, Number(activityId), dealId, companyId],
  )

  return success()
}

async function handleDelete(
  formData: FormData,
  dealId: number,
  companyId: number,
  createdBy: Nullable<string>,
  userId: number,
) {
  const activityId = formData.get('activityId')

  if (!activityId || Number.isNaN(Number(activityId))) {
    return badRequest('Valid activity ID is required')
  }

  const rows = await selectMany<{ id: number; name: string }>(
    db,
    'SELECT id, name FROM deal_activities WHERE id = ? AND deal_id = ? AND company_id = ? AND deleted_at IS NULL',
    [Number(activityId), dealId, companyId],
  )

  if (!rows.length) {
    return notFound('Activity not found')
  }

  await db.execute(
    'UPDATE deal_activities SET deleted_at = NOW() WHERE id = ? AND deal_id = ? AND company_id = ?',
    [Number(activityId), dealId, companyId],
  )

  if (createdBy) {
    await notifyDealAssignee(
      db,
      dealId,
      userId,
      createdBy,
      rows[0].name,
      'activity_deleted',
    )
  }

  return success()
}
