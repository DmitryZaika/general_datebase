import type { LoaderFunctionArgs } from 'react-router'
import { redirect } from 'react-router'
import { companyHasCloudTalk } from '~/utils/cloudtalkContactSync.server'
import { getAdminUser } from '~/utils/session.server'

export { default } from './employee.cloudtalk'

// Gate /admin/cloudtalk at the admin tier (the re-exported loader is employee-tier).
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!(await companyHasCloudTalk(user.company_id))) {
      throw redirect('/admin/deals')
    }
    return {
      userId: user.id,
      hasCloudtalkAgent: Boolean(user.cloudtalk_agent_id),
      isAdmin: true,
      readOnly: true,
    }
  } catch (error) {
    if (error instanceof Response) throw error
    throw redirect('/login')
  }
}
