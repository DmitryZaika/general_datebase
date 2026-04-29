import { zodResolver } from '@hookform/resolvers/zod'
import bcrypt from 'bcryptjs'
import { Info } from 'lucide-react'
import type { ResultSetHeader } from 'mysql2'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { PositionInfoIcon } from '~/components/molecules/PositionInfoIcon'
import { SelectInput } from '~/components/molecules/SelectItem'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Switch } from '~/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { POSITIONS } from '~/constants/positions'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { selectMany } from '~/utils/queryHelpers'
import { getSuperUser, type SessionUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { FormField, FormProvider } from '../components/ui/form'

interface Company {
  id: number
  name: string
}

const userschema = z.object({
  name: z.string().min(1),
  phone_number: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.union([z.email().optional(), z.literal('')]),
  password: z.coerce.string().min(4),
  company_id: z.coerce.number(),
  positions: z.union([
    z.string().transform(val => {
      if (!val) return []
      return val
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !Number.isNaN(id))
    }),
    z.array(z.coerce.number()),
    z.coerce.number().transform(val => [val]),
  ]),
  is_admin: z.boolean(),
})

const resolver = zodResolver(userschema)

export async function action({ request }: ActionFunctionArgs) {
  let creator: SessionUser
  try {
    creator = await getSuperUser(request)
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
  const password = await bcrypt.hash(data.password, 10)

  const createdByName = creator.name.trim().length > 0 ? creator.name.trim() : null

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (name, phone_number, email, password, company_id, is_employee, is_admin, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      data.name,
      data.phone_number,
      data.email,
      password,
      data.company_id,
      data.is_admin,
      createdByName,
    ],
  )

  const userId = result.insertId

  for (const positionId of data.positions) {
    await db.execute(
      'INSERT INTO users_positions (user_id, position_id, company_id) VALUES (?, ?, ?)',
      [userId, positionId, data.company_id],
    )
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'user added'))
  return redirect(`..${searchString}`, {
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
  const positions = await selectMany<{ id: number; name: string }>(
    db,
    'select id, name from positions',
  )
  return { companies, positions }
}

export default function UsersAdd() {
  const navigate = useNavigate()
  const { companies } = useLoaderData<typeof loader>()
  const cleanCompanies = companies.map(company => ({
    key: company.id,
    value: company.name,
  }))
  const cleanPositions = POSITIONS.map(position => ({
    key: position.id,
    value: position.displayName,
    description: position.description,
  }))
  const form = useForm({
    resolver,
    defaultValues: {
      name: '',
      phone_number: '',
      email: '',
      password: '',
      company_id: undefined,
      positions: [],
      is_admin: false,
    },
  })
  const fullSubmit = useFullSubmit(form)
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='customerForm' method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem name={'User Name'} placeholder={'Name*'} field={field} />
              )}
            />

            <FormField
              control={form.control}
              name='phone_number'
              render={({ field }) => (
                <InputItem
                  name={'Phone Number'}
                  placeholder={'Phone Number'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <InputItem name={'Email'} placeholder={'Email'} field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <InputItem name={'Password'} placeholder={'Password'} field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='company_id'
              render={({ field }) => (
                <SelectInput field={field} name='Company' options={cleanCompanies} />
              )}
            />
            <div className='grid grid-cols-2 gap-2'>
              {cleanPositions.map(position => (
                <FormField
                  key={position.key}
                  control={form.control}
                  name='positions'
                  render={({ field }) => (
                    <div className='flex items-center space-x-2'>
                      <Switch
                        id={`position-${position.key}`}
                        checked={
                          Array.isArray(field.value) &&
                          field.value.includes(position.key)
                        }
                        onCheckedChange={checked => {
                          if (checked && Array.isArray(field.value)) {
                            field.onChange([...field.value, position.key])
                          } else if (Array.isArray(field.value)) {
                            field.onChange(
                              field.value.filter((id: number) => id !== position.key),
                            )
                          }
                        }}
                      />
                      <label
                        htmlFor={`position-${position.key}`}
                        className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                      >
                        {position.value}
                      </label>
                      <PositionInfoIcon positionId={position.key} />
                    </div>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name='is_admin'
                render={({ field }) => (
                  <div className='flex items-center space-x-2'>
                    <Switch
                      id='admin-switch'
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <label
                      htmlFor='admin-switch'
                      className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                    >
                      Admin
                    </label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className='w-4 h-4 text-gray-500 hover:text-gray-700 cursor-help' />
                        </TooltipTrigger>
                        <TooltipContent className='max-w-xs'>
                          <div className='space-y-2'>
                            <div className='font-semibold'>Administrator</div>
                            <p className='text-sm text-white-600'>
                              Full system access with administrative privileges. Can
                              manage users, settings, and all company data.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              />
            </div>

            <DialogFooter>
              <Button type='submit'>Save changes</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
