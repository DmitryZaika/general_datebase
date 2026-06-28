import { type LoaderFunctionArgs, redirect } from 'react-router'
import { GraniteManagerLanding } from '~/components/pages/GraniteManagerLanding'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
    return redirect('/employee')
  } catch {
    return null
  }
}

export default function Index() {
  return <GraniteManagerLanding />
}
