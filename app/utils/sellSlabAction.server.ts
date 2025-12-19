import { zodResolver } from '@hookform/resolvers/zod'
import { redirect, data as routerData } from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { Contract } from '~/orm/contract'
import { customerSchema } from '~/schemas/sales'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

const resolver = zodResolver(customerSchema)

export async function handleSellSlabAction(request: Request) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const { errors, data, receivedValues } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  for (const room of data.rooms) {
    if (room.slabs.length === 0) {
      const session = await getSession(request.headers.get('Cookie'))
      session.flash(
        'message',
        toastData('Error', 'At least one slab is required in each room', 'destructive'),
      )
      return routerData(
        {
          errors: {
            rooms: {
              _errors: ['At least one slab is required in each room'],
            },
          },
        },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    }
  }

  const contract = new Contract(data)

  try {
    await contract.sell(user)
  } catch (error) {
    const session = await getSession(request.headers.get('Cookie'))
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to complete sale'
    session.flash('message', toastData('Error', errorMessage, 'destructive'))

    return routerData(
      { errors: { _errors: [errorMessage] } },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sale completed successfully'))

  const separator = searchString ? '&' : '?'
  return redirect(`..${searchString}${separator}saleId=${contract.saleId}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}
