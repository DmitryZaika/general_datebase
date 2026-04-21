import { type LoaderFunctionArgs, redirect } from 'react-router'
import { fetchCallsForPhones } from '~/utils/cloudtalk.server'
import { normalizeToE164 } from '~/utils/phone'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  let companyId: number
  try {
    const user = await getEmployeeUser(request)
    companyId = user.company_id
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const url = new URL(request.url)
  const phoneParam = url.searchParams.get('phone')
  const phone2Param = url.searchParams.get('phone2')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')

  const phones = [phoneParam, phone2Param]
    .map(normalizeToE164)
    .filter((p): p is string => !!p)

  const extraParams: Record<string, string | number> = {}
  if (dateFrom) extraParams.date_from = dateFrom
  if (dateTo) extraParams.date_to = dateTo

  return await fetchCallsForPhones(companyId, phones, extraParams)
}
