import { type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getQboToken, setQboSession } from '~/utils/quickbooks.server'
import { getEmployeeUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie')
  const session = await getSession(cookieHeader)

  let user
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const url = new URL(request.url)
  const realmId = url.searchParams.get('realmId')
  if (!realmId) {
    session.flash(
      'message',
      toastData('Error', 'Invalid data returned from quickbooks'),
    )
    return redirect('/employee/user', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  }

  const qboToken = await getQboToken(request, user.company_id)
  session.set('qboRealmId', realmId)
  setQboSession(session, qboToken)
  session.flash('message', toastData('Success', 'Quickbooks connected successfully'))

  return redirect('/employee/user', {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  })
}
