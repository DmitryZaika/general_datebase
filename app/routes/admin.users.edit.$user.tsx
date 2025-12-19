// app/routes/users.$user.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
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
import { FormField, FormProvider } from '~/components/ui/form'
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
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

const userschema = z.object({
  name: z.string().min(1),
  phone_number: z.union([z.coerce.string().min(10), z.literal('')]).optional(),
  email: z.union([z.string().email().optional(), z.literal('')]),
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
  marketing_company_ids: z
    .union([
      z.string().transform(val => {
        if (!val) return []
        return val
          .split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !Number.isNaN(id))
      }),
      z.array(z.coerce.number()),
      z.coerce.number().transform(val => [val]),
    ])
    .optional()
    .default([]),
  is_admin: z.boolean(),
})

type FormData = z.infer<typeof userschema>
const resolver = zodResolver(userschema)

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user)
  const { errors, data, receivedValues } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }

  await db.execute(
    `
    UPDATE users
    SET
      name = ?,
      email = ?,
      phone_number = ?,
      company_id = ?,
      is_admin = ?
    WHERE id = ?
    `,
    [data.name, data.email, data.phone_number, data.company_id, data.is_admin, userId],
  )

  await db.execute('DELETE FROM users_positions WHERE user_id = ?', [userId])

  const uniquePositions = [...new Set(data.positions)]
  const uniqueMarketingCompanies = [...new Set(data.marketing_company_ids ?? [])]

  for (const positionId of uniquePositions) {
    if (positionId === 7) {
      const companies =
        uniqueMarketingCompanies.length > 0
          ? uniqueMarketingCompanies
          : [data.company_id]
      for (const companyId of companies) {
        await db.execute(
          'INSERT INTO users_positions (user_id, position_id, company_id) VALUES (?, ?, ?)',
          [userId, positionId, companyId],
        )
      }
    } else {
      await db.execute(
        'INSERT INTO users_positions (user_id, position_id, company_id) VALUES (?, ?, ?)',
        [userId, positionId, data.company_id],
      )
    }
  }
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'User updated'))
  return redirect(`..${searchString}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

interface Company {
  id: number
  name: string
}

interface User {
  id: number
  name: null | string
  email: null | string
  phone_number: null | string
  company_id: number
  is_admin: null | number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user)
  if (Number.isNaN(userId)) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  const user = await selectId<User>(
    db,
    'SELECT id, name, email, phone_number, company_id, is_admin FROM users WHERE id = ? AND is_deleted = 0',
    userId,
  )
  if (!user) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }

  const userPositions = await selectMany<{ position_id: number }>(
    db,
    'SELECT position_id FROM users_positions WHERE user_id = ?',
    [userId],
  )

  const marketingCompanies = await selectMany<{ company_id: number }>(
    db,
    'SELECT company_id FROM users_positions WHERE user_id = ? AND position_id = 7',
    [userId],
  )

  const companies = await selectMany<Company>(db, 'SELECT id, name FROM company')
  const positions = POSITIONS.map(p => ({
    key: p.id,
    value: p.displayName,
    description: p.description,
  }))
  return {
    user,
    userPositions: userPositions.map(up => up.position_id),
    companies: companies.map(c => ({ key: c.id, value: c.name })),
    positions: positions,
    marketingCompanyIds: marketingCompanies.map(mc => mc.company_id),
  }
}

export default function User() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, userPositions, companies, positions, marketingCompanyIds } =
    useLoaderData<{
      user: User
      userPositions: number[]
      companies: Array<{ key: number; value: string }>
      positions: Array<{ key: number; value: string }>
      marketingCompanyIds: number[]
    }>()

  const token = useAuthenticityToken()
  const form = useForm({
    resolver,
    defaultValues: {
      name: user.name || '',
      phone_number: user.phone_number || '',
      email: user.email || '',
      company_id: user.company_id,
      positions: userPositions,
      marketing_company_ids: marketingCompanyIds,
      is_admin: user.is_admin === 1,
    },
  })

  const fullSubmit = useFullSubmit(form)
  const isSubmitting = form.formState.isSubmitting
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>User</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <InputItem name='Name' placeholder='Name' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='phone_number'
              render={({ field }) => (
                <InputItem name='Phone' placeholder='Phone' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <InputItem name='Email' placeholder='Email' field={field} />
              )}
            />
            <FormField
              control={form.control}
              name='company_id'
              render={({ field }) => (
                <SelectInput field={field} name='Company' options={companies} />
              )}
            />
            <div className='grid grid-cols-2 gap-2'>
              {positions.map(position => (
                <FormField
                  key={position.key}
                  control={form.control}
                  name='positions'
                  render={({ field }) => (
                    <div className='flex items-center space-x-2'>
                      <Switch
                        id={`position-${position.key}`}
                        checked={field.value.includes(position.key)}
                        onCheckedChange={checked => {
                          if (checked) {
                            field.onChange([...field.value, position.key])
                          } else {
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
              {form.watch('positions').includes(7) && (
                <div className='col-span-2 border-t pt-2 mt-2'>
                  <div className='text-sm font-medium mb-2'>
                    External Marketing Companies
                  </div>
                  {companies.map(company => (
                    <FormField
                      key={company.key}
                      control={form.control}
                      name='marketing_company_ids'
                      render={({ field }) => (
                        <div className='flex items-center space-x-2'>
                          <Switch
                            id={`marketing-company-${company.key}`}
                            checked={field.value.includes(company.key)}
                            onCheckedChange={checked => {
                              if (checked) {
                                field.onChange([...field.value, company.key])
                              } else {
                                field.onChange(
                                  field.value.filter(
                                    (id: number) => id !== company.key,
                                  ),
                                )
                              }
                            }}
                          />
                          <label
                            htmlFor={`marketing-company-${company.key}`}
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                          >
                            {company.value}
                          </label>
                        </div>
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type='submit' disabled={isSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
