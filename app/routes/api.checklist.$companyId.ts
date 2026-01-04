import { type ActionFunctionArgs, data } from 'react-router'
import { db } from '~/db.server'
import { checklistSchema } from '~/schemas/checklist'
import { commitSession, getSession } from '~/sessions.server'
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
