import { db } from '~/db.server'
import { sendEmail } from '~/lib/email.server'
import { companyHasCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { mapCloudTalkSendError, sendSmsViaCloudTalk } from '~/utils/cloudtalkSendSms.server'
import { finalizeOutboundSms, insertPendingOutboundSms } from '~/utils/cloudtalkSmsService.server'
import { canonicalPhone10, normalizeToE164 } from '~/utils/phone'
import { selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'

interface NotifyParams {
  companyId: number
  origin: string
  email?: string | null
  customerId?: number | null
}

function surveyMessageText(companyName: string, surveyUrl: string): string {
  return `Thank you for choosing ${companyName}! Please fill out our post-installation survey to help us improve: ${surveyUrl}`
}

async function loadCompanyName(companyId: number): Promise<string> {
  const rows = await selectMany<{ name: string }>(
    db,
    'SELECT name FROM company WHERE id = ? LIMIT 1',
    [companyId],
  )
  return rows[0]?.name ?? 'Our Company'
}

async function loadOfficeManager(companyId: number): Promise<SessionUser | undefined> {
  const rows = await selectMany<SessionUser>(
    db,
    `SELECT u.id, u.email, u.name, u.phone_number, u.is_employee, u.is_admin,
            u.is_superuser, u.company_id, u.pined_bar, u.cloudtalk_agent_id,
            u.cloudtalk_phone_number
     FROM users u
     JOIN users_positions up ON up.user_id = u.id
     JOIN positions p ON p.id = up.position_id
     WHERE up.company_id = ?
       AND p.name = 'office_manager'
       AND u.is_deleted = 0
       AND u.cloudtalk_phone_number IS NOT NULL
       AND TRIM(u.cloudtalk_phone_number) != ''
     ORDER BY u.name ASC
     LIMIT 1`,
    [companyId],
  )
  return rows[0]
}

async function loadCustomerPhone(
  companyId: number,
  customerId: number,
): Promise<string | undefined> {
  const rows = await selectMany<{ phone: string | null; phone_2: string | null }>(
    db,
    `SELECT phone, phone_2 FROM customers
     WHERE id = ? AND company_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [customerId, companyId],
  )
  const customer = rows[0]
  if (!customer) return undefined
  const primary = customer.phone?.trim() ?? ''
  if (primary.length > 0) return primary
  const secondary = customer.phone_2?.trim() ?? ''
  return secondary.length > 0 ? secondary : undefined
}

async function sendSurveySms(params: {
  companyId: number
  companyName: string
  surveyUrl: string
  customerId: number | null
}): Promise<void> {
  const { companyId, companyName, surveyUrl, customerId } = params
  if (!(await companyHasCloudTalk(companyId))) return
  if (customerId === null) return

  const officeManager = await loadOfficeManager(companyId)
  if (!officeManager) return

  const customerPhone = await loadCustomerPhone(companyId, customerId)
  if (!customerPhone) return

  const senderE164 = normalizeToE164(officeManager.cloudtalk_phone_number)
  const toE164 = normalizeToE164(customerPhone)
  const phoneDigits = canonicalPhone10(customerPhone)
  if (!senderE164 || !toE164 || phoneDigits.length < 10) return

  const text = surveyMessageText(companyName, surveyUrl)
  const pending = await insertPendingOutboundSms({
    user: officeManager,
    phoneDigits,
    text,
  })

  try {
    const sendResult = await sendSmsViaCloudTalk({
      companyId,
      senderE164,
      toPhoneE164: toE164,
      text,
      idempotencyKey: pending.idempotencyKey,
    })
    await finalizeOutboundSms({
      id: pending.id,
      status: 'sent',
      cloudtalkId: sendResult.cloudtalkId,
      errorMessage: null,
    })
  } catch (err) {
    await finalizeOutboundSms({
      id: pending.id,
      status: 'failed',
      cloudtalkId: null,
      errorMessage: mapCloudTalkSendError(err),
    })
    console.error('checklist survey SMS failed', err)
  }
}

export async function sendPostInstallSurveyNotifications(
  params: NotifyParams,
): Promise<void> {
  const companyName = await loadCompanyName(params.companyId)
  const surveyUrl = `${params.origin}/customer/${params.companyId}/survey`
  const email = params.email?.trim() ?? ''

  if (email.length > 0) {
    const text = surveyMessageText(companyName, surveyUrl)
    await sendEmail({
      to: email,
      subject: `${companyName} - Post-Installation Survey`,
      html: `<p>Thank you for choosing ${companyName}!</p><p>Please fill out our post-installation survey to help us improve: <a href="${surveyUrl}">${surveyUrl}</a></p>`,
      text,
    })
  }

  await sendSurveySms({
    companyId: params.companyId,
    companyName,
    surveyUrl,
    customerId: params.customerId ?? null,
  })
}
