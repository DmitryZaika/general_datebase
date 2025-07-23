import { redirect } from 'react-router'

export async function loader() {
  // Redirect to the default schedule view (month)
  throw redirect('/employee/schedule/month')
}
