import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import {
  AdminInfoIcon,
  PositionInfoIcon,
} from '~/components/molecules/PositionInfoIcon'
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
import { POSITIONS } from '~/constants/positions'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { Positions } from '~/types'
import type { Nullable } from '~/types/utils'
import { canEditAdminUsers } from '~/utils/adminUsersAccess.server'
import { optionalTrimmedEmailOrEmpty } from '~/utils/constants'
import { csrf } from '~/utils/csrf.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import type { SessionUser } from '~/utils/session.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

const userschema = z.object({
  name: z.string().trim().min(1),
  phone_number: z
    .preprocess(
      val => (typeof val === 'string' ? val.trim() : val),
      z.union([z.coerce.string().min(10), z.literal('')]),
    )
    .optional(),
  email: optionalTrimmedEmailOrEmpty,
  company_id: z.coerce.number(),
  positions: z.union([
    z.string().transform(val => {
      if (!val) return []
      return val
        .split(',')
        .map(id => parseInt(id.trim(), 10))
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
          .map(id => parseInt(id.trim(), 10))
          .filter(id => !Number.isNaN(id))
      }),
      z.array(z.coerce.number()),
      z.coerce.number().transform(val => [val]),
    ])
    .optional()
    .prefault([]),
  is_admin: z.boolean(),
  cloudtalk_agent_id: z
    .preprocess(
      val => {
        if (val === null || val === undefined) return ''
        return typeof val === 'string' ? val.trim() : String(val).trim()
      },
      z.union([z.string().max(36), z.literal('')]),
    )
    .optional(),
  cloudtalk_phone_number: z.coerce
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined || String(val).trim() === '') return
      const digits = String(val).replace(/\D/g, '')
      if (digits.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CloudTalk phone must include at least 10 digits',
        })
      }
    }),
  superadmin_company_ids: z
    .union([
      z.string().transform(val => {
        if (!val) return []
        return val
          .split(',')
          .map(id => parseInt(id.trim(), 10))
          .filter(id => !Number.isNaN(id))
      }),
      z.array(z.coerce.number()),
      z.coerce.number().transform(val => [val]),
    ])
    .optional()
    .prefault([]),
})

const resolver = zodResolver(userschema)

export async function action({ request, params }: ActionFunctionArgs) {
  let loggedInUser: SessionUser
  try {
    loggedInUser = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const loggedInIsSuperuser = Boolean(loggedInUser.is_superuser)
  const canEditUsers = await canEditAdminUsers(loggedInUser)
  if (!canEditUsers) {
    return forceRedirectError(request.headers, 'Unauthorized')
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user, 10)
  const existingUser = await selectId<User>(
    db,
    'SELECT id, company_id, is_admin FROM users WHERE id = ? AND is_deleted = 0',
    userId,
  )
  if (!existingUser) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  if (!loggedInIsSuperuser && existingUser.company_id !== loggedInUser.company_id) {
    return forceRedirectError(request.headers, 'Unauthorized')
  }
  const { errors, data, receivedValues } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }

  const existingPositionRows = await selectMany<{ position_id: number }>(
    db,
    'SELECT DISTINCT position_id FROM users_positions WHERE user_id = ?',
    [userId],
  )
  const existingPositionIds = existingPositionRows.map(row => row.position_id)

  if (!loggedInIsSuperuser) {
    data.company_id = existingUser.company_id
    data.is_admin = existingUser.is_admin === 1
    data.positions = data.positions.filter(id => id !== Positions.SuperAdmin)
    data.superadmin_company_ids = []
    for (const positionId of existingPositionIds) {
      if (positionId === Positions.SuperAdmin && !data.positions.includes(positionId)) {
        data.positions.push(positionId)
      }
    }
  }

  if (data.positions.includes(Positions.SuperAdmin)) {
    data.is_admin = true
  }

  const cloudtalkAgentId =
    data.cloudtalk_agent_id && data.cloudtalk_agent_id.trim() !== ''
      ? data.cloudtalk_agent_id.trim()
      : null
  const cloudtalkPhoneDigits = (data.cloudtalk_phone_number ?? '').replace(/\D/g, '')
  const cloudtalkPhoneNumber =
    cloudtalkPhoneDigits.length >= 10 ? cloudtalkPhoneDigits.slice(-10) : null

  await db.execute(
    `
    UPDATE users
    SET
      name = ?,
      email = ?,
      phone_number = ?,
      company_id = ?,
      is_admin = ?,
      cloudtalk_agent_id = ?,
      cloudtalk_phone_number = ?
    WHERE id = ?
    `,
    [
      data.name,
      data.email || null,
      data.phone_number || null,
      data.company_id,
      data.is_admin,
      cloudtalkAgentId,
      cloudtalkPhoneNumber,
      userId,
    ],
  )

  await db.execute('DELETE FROM users_positions WHERE user_id = ?', [userId])

  const uniquePositions = [...new Set(data.positions)]
  const uniqueMarketingCompanies = [...new Set(data.marketing_company_ids ?? [])]
  const uniqueSuperadminCompanies = [...new Set(data.superadmin_company_ids ?? [])]

  for (const positionId of uniquePositions) {
    if (positionId === Positions.ExternalMarketing) {
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
    } else if (positionId === Positions.SuperAdmin) {
      const companies =
        uniqueSuperadminCompanies.length > 0
          ? uniqueSuperadminCompanies
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
  name: Nullable<string>
  email: Nullable<string>
  phone_number: Nullable<string>
  company_id: number
  is_admin: Nullable<number>
  is_superuser: Nullable<number>
  is_employee: Nullable<number>
  cloudtalk_agent_id: Nullable<string>
  cloudtalk_phone_number: Nullable<string>
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let loggedInUser: SessionUser
  try {
    loggedInUser = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const loggedInIsSuperuser = Boolean(loggedInUser.is_superuser)
  const canEditUsers = await canEditAdminUsers(loggedInUser)
  if (!canEditUsers) {
    return forceRedirectError(request.headers, 'Unauthorized')
  }
  if (!params.user) {
    return forceRedirectError(request.headers, 'No user id provided')
  }
  const userId = parseInt(params.user, 10)
  if (Number.isNaN(userId)) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  const user = await selectId<User>(
    db,
    'SELECT id, name, email, phone_number, company_id, is_admin, is_superuser, is_employee, cloudtalk_agent_id, cloudtalk_phone_number FROM users WHERE id = ? AND is_deleted = 0',
    userId,
  )
  if (!user) {
    return forceRedirectError(request.headers, 'Invalid user id')
  }
  if (!loggedInIsSuperuser && user.company_id !== loggedInUser.company_id) {
    return forceRedirectError(request.headers, 'Unauthorized')
  }

  const userPositions = await selectMany<{ position_id: number }>(
    db,
    'SELECT DISTINCT position_id FROM users_positions WHERE user_id = ?',
    [userId],
  )

  const marketingCompanies = await selectMany<{ company_id: number }>(
    db,
    'SELECT company_id FROM users_positions WHERE user_id = ? AND position_id = ?',
    [userId, Positions.ExternalMarketing],
  )

  const superadminCompanies = await selectMany<{ company_id: number }>(
    db,
    'SELECT company_id FROM users_positions WHERE user_id = ? AND position_id = ?',
    [userId, Positions.SuperAdmin],
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
    superadminCompanyIds:
      superadminCompanies.length > 0
        ? superadminCompanies.map(sc => sc.company_id)
        : [],
    loggedInIsSuperuser,
  }
}

export default function User() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    user,
    userPositions,
    companies,
    positions,
    marketingCompanyIds,
    superadminCompanyIds,
    loggedInIsSuperuser,
  } = useLoaderData<typeof loader>()

  const actionData = useActionData<{
    error?: string
    errors?: Record<string, { message?: string }>
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
      cloudtalk_agent_id: user.cloudtalk_agent_id || '',
      cloudtalk_phone_number: user.cloudtalk_phone_number || '',
      superadmin_company_ids: superadminCompanyIds,
    },
  })

  const fullSubmit = useFullSubmit(form, undefined, 'POST', undefined, true)
  const isSubmitting = form.formState.isSubmitting
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  useEffect(() => {
    if (!actionData?.errors) return
    for (const [field, err] of Object.entries(actionData.errors)) {
      form.setError(field as Parameters<typeof form.setError>[0], {
        type: 'server',
        message: err?.message ?? 'invalid',
      })
    }
  }, [actionData, form])

  const formPositions = form.watch('positions')
  const visiblePositions = loggedInIsSuperuser
    ? positions
    : positions.filter(p => p.key !== Positions.SuperAdmin)

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-106.25 max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>User</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />
            {actionData?.error && (
              <div className='mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
                {actionData.error}
              </div>
            )}
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
            {loggedInIsSuperuser ? (
              <FormField
                control={form.control}
                name='company_id'
                render={({ field }) => (
                  <SelectInput field={field} name='Company' options={companies} />
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name='company_id'
                render={({ field }) => (
                  <input
                    type='hidden'
                    name={field.name}
                    value={String(field.value ?? '')}
                  />
                )}
              />
            )}
            <FormField
              control={form.control}
              name='cloudtalk_agent_id'
              render={({ field }) => (
                <div className='mb-6'>
                  <InputItem
                    name='CloudTalk agent ID'
                    placeholder='CloudTalk agent ID'
                    field={field}
                  />
                  <p className='text-xs text-gray-500 -mt-1'>
                    Set this to enable sending SMS from the CRM. Find the value in
                    CloudTalk → Users → Edit user → Agent ID will be in the URL.
                  </p>
                </div>
              )}
            />
            <FormField
              control={form.control}
              name='cloudtalk_phone_number'
              render={({ field }) => (
                <div className='mb-6'>
                  <InputItem
                    name='CloudTalk phone number'
                    placeholder='CloudTalk phone number'
                    field={field}
                  />
                  <p className='text-xs text-gray-500 -mt-1'>
                    The CloudTalk line used as the SMS sender for this user.
                  </p>
                </div>
              )}
            />
            <div className='grid grid-cols-2 gap-2'>
              {visiblePositions.map(position => (
                <FormField
                  key={position.key}
                  control={form.control}
                  name='positions'
                  render={({ field }) => (
                    <div className='flex items-center gap-1.5'>
                      <PositionInfoIcon positionId={position.key} />
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
                    </div>
                  )}
                />
              ))}
              {loggedInIsSuperuser ? (
                <FormField
                  control={form.control}
                  name='is_admin'
                  render={({ field }) => (
                    <div className='flex items-center gap-1.5'>
                      <AdminInfoIcon />
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
                    </div>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name='is_admin'
                  render={({ field }) => (
                    <input
                      type='hidden'
                      name={field.name}
                      value={field.value ? 'true' : 'false'}
                    />
                  )}
                />
              )}
              {Array.isArray(formPositions) &&
                formPositions.includes(Positions.ExternalMarketing) && (
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
                              checked={
                                Array.isArray(field.value) &&
                                field.value.includes(company.key)
                              }
                              onCheckedChange={checked => {
                                if (checked && Array.isArray(field.value)) {
                                  field.onChange([...field.value, company.key])
                                } else if (Array.isArray(field.value)) {
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
              {loggedInIsSuperuser &&
              Array.isArray(formPositions) &&
              formPositions.includes(Positions.SuperAdmin) ? (
                <div className='col-span-2 border-t pt-2 mt-2'>
                  <div className='text-sm font-medium mb-2'>Super Admin Companies</div>
                  {companies.map(company => (
                    <FormField
                      key={company.key}
                      control={form.control}
                      name='superadmin_company_ids'
                      render={({ field }) => (
                        <div className='flex items-center space-x-2'>
                          <Switch
                            id={`superadmin-company-${company.key}`}
                            checked={
                              Array.isArray(field.value) &&
                              field.value.includes(company.key)
                            }
                            onCheckedChange={checked => {
                              if (checked && Array.isArray(field.value)) {
                                field.onChange([...field.value, company.key])
                              } else if (Array.isArray(field.value)) {
                                field.onChange(
                                  field.value.filter(
                                    (id: number) => id !== company.key,
                                  ),
                                )
                              }
                            }}
                          />
                          <label
                            htmlFor={`superadmin-company-${company.key}`}
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                          >
                            {company.value}
                          </label>
                        </div>
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <DialogFooter className='mt-2'>
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
