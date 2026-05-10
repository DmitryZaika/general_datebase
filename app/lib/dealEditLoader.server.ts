import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import {
  type EmailHistory,
  getCustomerEmailsWithReads,
  getDealEmailsWithReads,
} from '~/crud/emails'
import { db } from '~/db.server'
import { fetchNotesWithComments } from '~/lib/noteHelpers.server'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type { DealEmailHistoryItem } from '~/types/dealActivityTypes'
import type { Nullable } from '~/types/utils'
import { selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'

export interface DealEditLoaderData {
  dealId: number
  stages: { id: number; name: string; position: number }[]
  history: { list_id: number; entered_at: string; exited_at: Nullable<string> }[]
  currentListId: number
  isClosed: boolean
  isWon: Nullable<number>
  closedAt: string | null
  activities: DealActivity[]
  notes: DealNote[]
  emails: DealEmailHistoryItem[]
  customerEmails: DealEmailHistoryItem[]
  imagesCount: number
  documentsCount: number
  currentUserName: string
}

function withThreadAttachmentStatus(rawEmails: EmailHistory[]): DealEmailHistoryItem[] {
  const attachmentByThread = new Map<string, boolean>()
  for (const email of rawEmails) {
    if (email.has_attachments) {
      attachmentByThread.set(email.thread_id, true)
    }
  }

  return rawEmails.map(email => ({
    ...email,
    thread_has_attachments: attachmentByThread.get(email.thread_id) ?? false,
  }))
}

export function createDealEditLoader(
  getUser: (request: Request) => Promise<SessionUser>,
  dealsRedirectPath: string,
) {
  return async function dealEditLoader({ request, params }: LoaderFunctionArgs) {
    try {
      const user = await getUser(request)
      const dealId = parseInt(params.dealId || '0', 10)
      if (!dealId) return redirect(dealsRedirectPath)

      const dealRows = await selectMany<{
        list_id: number
        group_id: number
        is_won: Nullable<number>
        customer_email: Nullable<string>
        customer_deal_count: number
      }>(
        db,
        `SELECT d.list_id, l.group_id, d.is_won, c.email customer_email,
                (
                  SELECT COUNT(*)
                  FROM deals d2
                  WHERE d2.customer_id = d.customer_id
                    AND d2.deleted_at IS NULL
                ) customer_deal_count
         FROM deals d
         JOIN deals_list l ON d.list_id = l.id
         JOIN customers c ON d.customer_id = c.id
         WHERE d.id = ? AND d.deleted_at IS NULL AND c.company_id = ?`,
        [dealId, user.company_id],
      )

      if (!dealRows.length) return redirect(dealsRedirectPath)

      const { list_id, group_id, is_won, customer_email, customer_deal_count } =
        dealRows[0]
      const customerEmail = customer_email?.trim()
      const customerDealCount = Number(customer_deal_count)
      const emailHistoryPromise =
        customerEmail && customerDealCount === 1
          ? getCustomerEmailsWithReads(customerEmail)
          : getDealEmailsWithReads(dealId)
      const customerEmailsPromise =
        customerEmail && customerDealCount > 1
          ? getCustomerEmailsWithReads(customerEmail)
          : Promise.resolve<EmailHistory[]>([])

      const [
        stages,
        history,
        activities,
        notes,
        rawEmails,
        rawCustomerEmails,
        imagesCountRows,
        documentsCountRows,
      ] = await Promise.all([
        selectMany<{ id: number; name: string; position: number }>(
          db,
          'SELECT id, name, position FROM deals_list WHERE group_id = ? AND deleted_at IS NULL ORDER BY position',
          [group_id],
        ),
        selectMany<{
          list_id: number
          entered_at: string
          exited_at: Nullable<string>
        }>(
          db,
          'SELECT list_id, entered_at, exited_at FROM deal_stage_history WHERE deal_id = ? ORDER BY entered_at',
          [dealId],
        ),
        selectMany<DealActivity>(
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
        ),
        fetchNotesWithComments(db, dealId, user.company_id),
        emailHistoryPromise,
        customerEmailsPromise,
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(*) AS c
             FROM deals_images
            WHERE deal_id = ?
              AND NOT (
                LOWER(image_url) LIKE '%.pdf'
                OR LOWER(image_url) LIKE '%.pdf?%'
                OR LOWER(image_url) LIKE '%.doc'
                OR LOWER(image_url) LIKE '%.doc?%'
                OR LOWER(image_url) LIKE '%.docx'
                OR LOWER(image_url) LIKE '%.docx?%'
                OR LOWER(image_url) LIKE '%.xls'
                OR LOWER(image_url) LIKE '%.xls?%'
                OR LOWER(image_url) LIKE '%.xlsx'
                OR LOWER(image_url) LIKE '%.xlsx?%'
                OR LOWER(image_url) LIKE '%.csv'
                OR LOWER(image_url) LIKE '%.csv?%'
                OR LOWER(image_url) LIKE '%.txt'
                OR LOWER(image_url) LIKE '%.txt?%'
              )`,
          [dealId],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT (
              SELECT COUNT(*) FROM deals_documents WHERE deal_id = ?
            ) + (
              SELECT COUNT(*)
              FROM deals_images
              WHERE deal_id = ?
                AND (
                  LOWER(image_url) LIKE '%.pdf'
                  OR LOWER(image_url) LIKE '%.pdf?%'
                  OR LOWER(image_url) LIKE '%.doc'
                  OR LOWER(image_url) LIKE '%.doc?%'
                  OR LOWER(image_url) LIKE '%.docx'
                  OR LOWER(image_url) LIKE '%.docx?%'
                  OR LOWER(image_url) LIKE '%.xls'
                  OR LOWER(image_url) LIKE '%.xls?%'
                  OR LOWER(image_url) LIKE '%.xlsx'
                  OR LOWER(image_url) LIKE '%.xlsx?%'
                  OR LOWER(image_url) LIKE '%.csv'
                  OR LOWER(image_url) LIKE '%.csv?%'
                  OR LOWER(image_url) LIKE '%.txt'
                  OR LOWER(image_url) LIKE '%.txt?%'
                )
            ) AS c`,
          [dealId, dealId],
        ),
      ])

      const emails = withThreadAttachmentStatus(rawEmails)
      const dealEmailIds = new Set(emails.map(email => email.id))
      const customerEmailHistory = withThreadAttachmentStatus(rawCustomerEmails)
      const hasCustomerEmailsOutsideDeal = customerEmailHistory.some(
        email => !dealEmailIds.has(email.id),
      )
      const customerEmails = hasCustomerEmailsOutsideDeal ? customerEmailHistory : []

      const isClosed = is_won === 1 || is_won === 0

      let closedAt: string | null = null
      if (isClosed && history.length > 0) {
        const last = history[history.length - 1]
        closedAt = last.exited_at ?? last.entered_at
      }

      return {
        dealId,
        stages,
        history,
        currentListId: list_id,
        isClosed,
        isWon: is_won,
        closedAt,
        activities,
        notes,
        emails,
        customerEmails,
        imagesCount: imagesCountRows[0]?.c ?? 0,
        documentsCount: documentsCountRows[0]?.c ?? 0,
        currentUserName: user.name ?? '',
      }
    } catch {
      return redirect('/login')
    }
  }
}
