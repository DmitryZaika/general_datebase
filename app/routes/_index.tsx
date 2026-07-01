import { type LoaderFunctionArgs, type MetaFunction, redirect } from 'react-router'
import { GraniteManagerLanding } from '~/components/pages/GraniteManagerLanding'
import { getEmployeeUser } from '~/utils/session.server'

export const meta: MetaFunction = () => {
  return [
    {
      title: 'All-in-One CRM & Inventory for Stone Fabricators',
    },
    {
      name: 'description',
      content:
        'The custom CRM built specifically for stone fabricators. Manage customer relationships, track production communication, and streamline your stone shop pipelines.',
    },
  ]
}

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
