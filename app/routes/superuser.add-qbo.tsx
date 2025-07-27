import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { SelectInput } from '~/components/molecules/SelectItem'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions'

import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { saveCompanyQBO } from '~/utils/quickbooks.server'
import { getSuperUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'
import { FormField, FormProvider } from '../components/ui/form'

interface Company {
  id: number
  name: string
}

const userschema = z.object({
  companyId: z.coerce.number().min(1),
  qboClientId: z.string().min(10),
  qboClientSecret: z.string().min(10),
})

type FormData = z.infer<typeof userschema>
const resolver = zodResolver(userschema)

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getSuperUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }
  saveCompanyQBO(data.companyId, data.qboClientId, data.qboClientSecret)
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'keys added'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const companies = await selectMany<Company>(db, 'select id, name from company')
  return { companies }
}

export default function UsersAdd() {
  const { companies } = useLoaderData<typeof loader>()
  const form = useForm<FormData>({
    resolver,
  })
  const fullSubmit = useFullSubmit(form)
  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className='container mx-auto py-5'>
        <FormField
          control={form.control}
          name='companyId'
          render={({ field }) => (
            <SelectInput
              field={field}
              name='Company'
              options={companies.map(company => ({
                key: company.id,
                value: company.name,
              }))}
            />
          )}
        />
        <FormField
          control={form.control}
          name='qboClientId'
          render={({ field }) => <InputItem name='QBO Client Id' field={field} />}
        />
        <FormField
          control={form.control}
          name='qboClientSecret'
          render={({ field }) => <InputItem name='QBO Client Secret' field={field} />}
        />
        <Button type='submit'>Save changes</Button>
      </Form>
    </FormProvider>
  )
}
