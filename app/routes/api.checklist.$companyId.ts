import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { sendEmail } from '~/lib/email.server'
import { checklistSchema } from '~/schemas/checklist'
import { commitSession, getSession } from '~/sessions.server'
import { selectId } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

function convertCheckboxToBoolean(value: string | undefined): boolean {
  return value === 'on'
}

export async function action({ request, params }: ActionFunctionArgs) {
  const cleanData = checklistSchema.safeParse(await request.json())
  if (!cleanData.success) {
    return { errors: cleanData.error.flatten().fieldErrors }
  }
  const formData = cleanData.data

  let installerId: number
  let companyId: number
  try {
    const user = await getEmployeeUser(request)
    installerId = user.id
    companyId = user.company_id
  } catch (_error) {
    return { error: 'Unauthorized' }
  }

  const paramCompanyId = Number(params.companyId)
  if (!Number.isFinite(paramCompanyId) || paramCompanyId <= 0) {
    return { error: 'Invalid company id' }
  }
  if (paramCompanyId !== companyId) {
    return { error: 'Unauthorized' }
  }

  await db.execute(
    `INSERT INTO checklists (
          customer_id, installer_id, customer_name, installation_address,
          material_correct, seams_satisfaction, appliances_fit, backsplashes_correct,
          edges_correct, holes_drilled, cleanup_completed, comments, signature,
          company_id, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      formData.customer_id || null,
      installerId,
      formData.customer_name,
      formData.installation_address,
      convertCheckboxToBoolean(formData.material_correct),
      convertCheckboxToBoolean(formData.seams_satisfaction),
      convertCheckboxToBoolean(formData.appliances_fit),
      convertCheckboxToBoolean(formData.backsplashes_correct),
      convertCheckboxToBoolean(formData.edges_correct),
      convertCheckboxToBoolean(formData.holes_drilled),
      convertCheckboxToBoolean(formData.cleanup_completed),
      formData.comments || null,
      formData.signature,
      companyId,
      formData.email || null,
    ],
  )

  if (formData.email) {
    const companyInfo = await selectId<{ name: string }>(
      db,
      'SELECT name FROM company WHERE id = ?',
      companyId,
    )
    const companyName = companyInfo?.name || "Our Company"
    const origin = new URL(request.url).origin
    const surveyUrl = `${origin}/customer/${companyId}/survey`

    await sendEmail({
      to: formData.email,
      subject: `${companyName} - Post-Installation Survey`,
      html: `<p>Thank you for choosing ${companyName}!</p><p>Please fill out our post-installation survey to help us improve: <a href="${surveyUrl}">${surveyUrl}</a></p>`,
      text: `Thank you for choosing ${companyName}! Please fill out our post-installation survey to help us improve: ${surveyUrl}`,
    })
  }

  // Flash success
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Checklist saved to database'))

  return data(
    { success: true },
    {
      headers: { 'Set-Cookie': await commitSession(session) },
    },
  )
}
