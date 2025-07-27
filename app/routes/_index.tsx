import { type LoaderFunction, redirect } from 'react-router'
import { getEmployeeUser } from '~/utils/session.server'

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getEmployeeUser(request)
  } catch {
    return redirect(`/login`)
  }
  return redirect('/employee')
}
