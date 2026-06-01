import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import { getAdminUser } from '~/utils/session.server'

export { default } from './employee.cloudtalk'

// Gate /admin/cloudtalk at the admin tier (the re-exported loader is employee-tier).
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    return {
      userId: user.id,
      hasCloudtalkAgent: Boolean(user.cloudtalk_agent_id),
      isAdmin: true,
    }
  } catch {
    throw redirect('/login')
  }
}
