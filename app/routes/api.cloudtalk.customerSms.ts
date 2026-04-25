import { type LoaderFunctionArgs, redirect } from 'react-router'
import { fetchSmsForCompanyAndPhones } from '~/utils/cloudtalkSms.server'
import { phoneDigitsOnly } from '~/utils/phone'
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
  const phoneDigits = ['phone', 'phone2']
    .map(k => url.searchParams.get(k))
    .filter((p): p is string => !!p)
    .map(phoneDigitsOnly)
    .filter(d => d.length >= 10)

  const result = await fetchSmsForCompanyAndPhones({ companyId, phoneDigits })
  return { ...result, customerPhoneDigits: phoneDigits }
}
