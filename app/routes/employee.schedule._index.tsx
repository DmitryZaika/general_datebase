import { type MetaFunction, redirect } from 'react-router'

export const meta: MetaFunction = () => {
  return [{ title: 'Schedule' }]
}

export async function loader() {
  // Redirect to the default schedule view (month)
  throw redirect('/employee/schedule/month')
}
