import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { EmailChatSkeletonContent } from '~/components/organisms/EmailChatSkeletonContent'
import { EmailSendDialogSkeletonContent } from '~/components/organisms/EmailSendDialogSkeletonContent'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import DealsEmailsView, { type Email } from '~/components/views/DealsEmailsView'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user: User = await getEmployeeUser(request)
    const userEmailNorm = (user.email || '').trim().toLowerCase()
    const userEmailLike = `%<${userEmailNorm}>`

    const url = new URL(request.url)
    const folder = url.searchParams.get('folder')
    const isSent = folder === 'sent'
    const isTrash = folder === 'trash'
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = 50
    const search = (url.searchParams.get('search') || '').trim()

    let customerEmailMatches: string[] = []
    if (search) {
      const rows = await selectMany<{ email: string }>(
        db,
        `SELECT DISTINCT LOWER(TRIM(email)) AS email
         FROM customers
         WHERE company_id = ?
           AND deleted_at IS NULL
           AND email IS NOT NULL
           AND email <> ''
           AND name LIKE ?
         LIMIT 500`,
        [user.company_id, `%${search}%`],
      )
      customerEmailMatches = rows.map(r => r.email).filter(Boolean)
    }

    const customerEmailClause = customerEmailMatches.length
      ? ` OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.sender_email, '<', -1), '>', 1))) IN (${customerEmailMatches.map(() => '?').join(',')}) OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) IN (${customerEmailMatches.map(() => '?').join(',')})`
      : ''

    const searchClause = search
      ? ` AND (e.subject LIKE ? OR e.body LIKE ? OR e.sender_email LIKE ? OR e.receiver_email LIKE ?${customerEmailClause})`
      : ''
    const searchParams: (string | number)[] = search
      ? [
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          ...customerEmailMatches,
          ...customerEmailMatches,
        ]
      : []

    const senderCondition = `(
      e.sender_user_id = ?
      OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.sender_email, '<', -1), '>', 1))) = ?
      OR (e.sender_email NOT LIKE '%<%' AND LOWER(TRIM(e.sender_email)) = ?)
      OR e.sender_email LIKE ?
    )`
    const receiverCondition = `(
      LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
      OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
      OR e.receiver_email LIKE ?
    )`

    const folderCondition = isTrash
      ? receiverCondition
      : isSent
        ? senderCondition
        : receiverCondition
    const folderParams = isTrash
      ? [userEmailNorm, userEmailNorm, userEmailLike]
      : isSent
        ? [user.id, userEmailNorm, userEmailNorm, userEmailLike]
        : [userEmailNorm, userEmailNorm, userEmailLike]

    const deletedClause = isTrash ? 'e.deleted_at IS NOT NULL' : 'e.deleted_at IS NULL'
    const folderWhere = `${deletedClause} AND ${folderCondition}`
    const whereThreadMatch = `${folderWhere}${searchClause}`
    const subqueryWhereBase = whereThreadMatch.replaceAll('e.', 'e2.')
    const paramsThreadMatch = [...folderParams, ...searchParams]
    const paramsListQuery = [...folderParams, ...paramsThreadMatch]
    const offset = (page - 1) * pageSize
    const threadOrderAgg = isTrash ? 'MAX(e2.deleted_at)' : 'MAX(e2.sent_at)'
    const listOrderBy = isTrash ? 'e.deleted_at DESC, e.sent_at DESC' : 'e.sent_at DESC'

    const [inboxUnreadRows, trashCountRows, totalCountRows, userEmails] =
      await Promise.all([
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c
           FROM emails e
           LEFT JOIN (
             SELECT thread_id, MAX(deal_id) AS deal_id
             FROM emails
             WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
             GROUP BY thread_id
           ) td ON td.thread_id = e.thread_id
           LEFT JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
           WHERE e.deleted_at IS NULL
             AND e.thread_id IS NOT NULL
             AND e.sender_user_id IS NULL
             AND e.employee_read_at IS NULL
             AND (
               e.receiver_user_id = ?
               OR d.user_id = ?
               OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
               OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
               OR e.receiver_email LIKE ?
             )`,
          [user.id, user.id, userEmailNorm, userEmailNorm, userEmailLike],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE e.deleted_at IS NOT NULL AND ${receiverCondition}`,
          [userEmailNorm, userEmailNorm, userEmailLike],
        ),
        selectMany<{ c: number }>(
          db,
          `SELECT COUNT(DISTINCT e.thread_id) AS c FROM emails e
         WHERE ${whereThreadMatch}`,
          paramsThreadMatch,
        ),
        selectMany<Email>(
          db,
          `SELECT e.id, e.thread_id, e.subject, e.body, e.sent_at, e.sender_email, e.receiver_email, e.sender_user_id, e.employee_read_at,
         (SELECT MAX(er.read_at) FROM email_reads er WHERE er.message_id = e.message_id) AS client_read_at,
         (SELECT COUNT(*) FROM email_attachments ea WHERE ea.email_id = e.id) > 0 as has_attachments,
         EXISTS (SELECT 1 FROM email_attachments ea2 INNER JOIN emails e3 ON ea2.email_id = e3.id WHERE e3.thread_id = e.thread_id) AS thread_has_attachments,
         COALESCE(s.name, (SELECT name FROM customers WHERE email = e.sender_email LIMIT 1)) as sender_name,
         COALESCE(r.name, (SELECT name FROM customers WHERE email = e.receiver_email LIMIT 1)) as receiver_name
         FROM emails e
         LEFT JOIN users s ON e.sender_user_id = s.id
         LEFT JOIN users r ON e.receiver_email = r.email
         WHERE ${folderWhere}
         AND e.thread_id IN (
           SELECT thread_id FROM (
             SELECT e2.thread_id, ${threadOrderAgg} AS mt
             FROM emails e2
             WHERE ${subqueryWhereBase}
             GROUP BY e2.thread_id
             ORDER BY mt DESC
             LIMIT ${pageSize} OFFSET ${offset}
           ) t
         )
         ORDER BY ${listOrderBy}`,
          paramsListQuery,
        ),
      ])

    const totalCount = totalCountRows[0]?.c ?? 0

    return {
      userEmails,
      userEmail: user.email,
      userId: user.id,
      folder: isTrash ? 'trash' : isSent ? 'sent' : 'inbox',
      inboxUnreadCount: inboxUnreadRows[0]?.c ?? 0,
      trashCount: trashCountRows[0]?.c ?? 0,
      totalCount,
      currentPage: page,
      pageSize,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

const EMPLOYEE_VIEW_ENTER = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.2, 0.78, 0.22, 1] as const },
}

function isEmployeeEmailActionPath(pathname: string) {
  return (
    pathname.includes('/employee/emails/chat/') ||
    pathname.endsWith('/employee/emails/sendEmail')
  )
}

function isSendEmailAction(pathname: string) {
  return pathname.endsWith('/employee/emails/sendEmail')
}

function getEmailDialogClassName(pathname: string) {
  if (isSendEmailAction(pathname)) {
    return 'sm:max-w-[700px] overflow-auto flex flex-col min-h-[500px] max-h-[95vh] p-5'
  }
  return 'max-w-[100%] sm:max-w-[90%] sm:max-w-[900px] h-[95%] p-0 flex flex-col overflow-hidden'
}

export type EmployeeEmailsOutletContext = {
  dismissEmailAction: () => void
}

export default function EmployeeEmails() {
  const location = useLocation()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [emailActionDismissed, setEmailActionDismissed] = useState(false)
  const {
    userEmails,
    userEmail,
    userId,
    folder,
    inboxUnreadCount,
    trashCount,
    totalCount,
    currentPage,
    pageSize,
  } = useLoaderData<{
    userEmails: Email[]
    userEmail: string
    userId: number
    folder: 'inbox' | 'sent' | 'trash'
    inboxUnreadCount: number
    trashCount: number
    totalCount: number
    currentPage: number
    pageSize: number
  }>()

  const navPath = navigation.location?.pathname ?? ''
  const isOnEmailAction = isEmployeeEmailActionPath(location.pathname)
  const isNavigatingToEmailAction =
    navigation.state === 'loading' &&
    navPath !== location.pathname &&
    isEmployeeEmailActionPath(navPath)
  const isEmailActionLoading = isNavigatingToEmailAction
  const showEmailDialog =
    !emailActionDismissed && (isOnEmailAction || isNavigatingToEmailAction)
  const emailActionPath = isOnEmailAction ? location.pathname : navPath
  const isSendEmail = isSendEmailAction(location.pathname) || isSendEmailAction(navPath)

  useEffect(() => {
    if (navigation.state === 'idle' && !isEmployeeEmailActionPath(location.pathname)) {
      setEmailActionDismissed(false)
    }
  }, [navigation.state, location.pathname])

  useEffect(() => {
    if (
      emailActionDismissed &&
      navigation.state === 'idle' &&
      isEmployeeEmailActionPath(location.pathname)
    ) {
      navigate(
        { pathname: '/employee/emails', search: location.search },
        { replace: true },
      )
    }
  }, [
    emailActionDismissed,
    navigation.state,
    location.pathname,
    location.search,
    navigate,
  ])

  const dismissEmailAction = () => {
    setEmailActionDismissed(true)
  }

  const handleEmailDialogClose = (open: boolean) => {
    if (!open) {
      dismissEmailAction()
      navigate({ pathname: '/employee/emails', search: location.search })
    }
  }

  return (
    <motion.div className='relative w-full h-full p-2' {...EMPLOYEE_VIEW_ENTER}>
      <div className={showEmailDialog ? 'pointer-events-none' : undefined}>
        <DealsEmailsView
          emails={userEmails}
          currentUserEmail={userEmail}
          currentUserId={userId}
          initialFolder={folder}
          inboxUnreadCount={inboxUnreadCount}
          trashCount={trashCount}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
        />
      </div>
      {showEmailDialog ? (
        <div className='fixed inset-0 z-50'>
          <Dialog open={true} onOpenChange={handleEmailDialogClose}>
            <DialogContent className={getEmailDialogClassName(emailActionPath)}>
              {isEmailActionLoading ? (
                isSendEmail ? (
                  <EmailSendDialogSkeletonContent />
                ) : (
                  <EmailChatSkeletonContent />
                )
              ) : (
                <Outlet
                  context={{ dismissEmailAction } satisfies EmployeeEmailsOutletContext}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </motion.div>
  )
}
