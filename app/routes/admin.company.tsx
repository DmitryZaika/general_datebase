import { type ChangeEvent, Suspense } from 'react'
import {
  type ActionFunctionArgs,
  Await,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { z } from 'zod'
import { CompanyLogoInput } from '~/components/molecules/CompanyLogoInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { AddressInput } from '~/components/organisms/AddressInput'
import { PageLayout } from '~/components/PageLayout'
import { Skeleton } from '~/components/ui/skeleton'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { canManageCompanySettings } from '~/utils/adminUsersAccess.server'
import {
  DEFAULT_COMPANY_LOGO_HEIGHT,
  resolveCompanyLogoHeight,
} from '~/utils/companyLogo'
import { parseOptionalMultiForm } from '~/utils/parseMultiForm'
import { selectId } from '~/utils/queryHelpers'
import { getAdminUser, type SessionUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { useCustomOptionalForm } from '~/utils/useCustomForm'
import { FormField } from '../components/ui/form'

interface CompanySettings {
  name: string | null
  address: string | null
  logo_url: string | null
  logo_height: number | string | null
  state_taxes: number | string | null
}

const optionalText = z.preprocess(val => {
  if (val === undefined || val === null) return null
  const str = String(val).trim()
  return str === '' ? null : str
}, z.string().nullable())

const companySettingsSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required'),
  address: optionalText,
  logo_height: z.preprocess(val => {
    if (val === undefined || val === null || val === '') return null
    const parsed = Number(val)
    return Number.isFinite(parsed) ? parsed : null
  }, z.number().min(32).max(192).nullable()),
  state_taxes: z.preprocess(val => {
    if (val === undefined || val === null || val === '') return null
    const parsed = Number(val)
    return Number.isFinite(parsed) ? parsed : null
  }, z.number().min(0).max(100).nullable()),
})

function dbTaxRateToDisplay(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 10000) / 100
}

function displayTaxRateToDb(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Math.round(value * 100) / 10000
}

async function requireCompanyManager(request: Request): Promise<SessionUser> {
  const user = await getAdminUser(request)
  const allowed = await canManageCompanySettings(user)
  if (!allowed) {
    throw new TypeError('Invalid user permissions')
  }
  return user
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Company' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireCompanyManager(request)

    return { data: loadPageData(user.company_id) }
    async function loadPageData(companyId: number) {
      const company = await selectId<CompanySettings>(
        db,
        `SELECT name, address, logo_url, logo_height, state_taxes
         FROM company WHERE id = ?`,
        companyId,
      )
      if (!company) {
        throw new Error('Company not found')
      }

      return {
        company: {
          ...company,
          logo_height: resolveCompanyLogoHeight(company.logo_height),
          state_taxes: dbTaxRateToDisplay(company.state_taxes),
        },
        companyId,
      }
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireCompanyManager(request)
    const { errors, data } = await parseOptionalMultiForm(
      request,
      companySettingsSchema,
      'company-logos',
    )
    if (errors || !data) {
      return { errors }
    }

    const existing = await selectId<{ logo_url: string | null }>(
      db,
      'SELECT logo_url FROM company WHERE id = ?',
      user.company_id,
    )

    const uploadedLogo = data.file
    const hasNewLogo = Boolean(uploadedLogo && uploadedLogo !== 'undefined')
    const nextLogoUrl = hasNewLogo
      ? Array.isArray(uploadedLogo)
        ? uploadedLogo[0]
        : uploadedLogo
      : (existing?.logo_url ?? null)

    await db.execute(
      `UPDATE company
       SET name = ?, address = ?, logo_url = ?, logo_height = ?, state_taxes = ?
       WHERE id = ?`,
      [
        data.name,
        data.address,
        nextLogoUrl || null,
        resolveCompanyLogoHeight(data.logo_height),
        displayTaxRateToDb(data.state_taxes),
        user.company_id,
      ],
    )

    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Company settings saved'))
    return redirect('/admin/company', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function AdminCompanySettings() {
  const { data } = useLoaderData<typeof loader>()

  return (
    <Suspense fallback={<HydrateFallback />}>
      <Await resolve={data}>
        {resolved => (
          <CompanySettingsContent
            company={resolved.company}
            companyId={resolved.companyId}
          />
        )}
      </Await>
    </Suspense>
  )
}

function CompanySettingsContent({
  company,
  companyId,
}: {
  company: CompanySettings & { logo_height: number | null; state_taxes: number | null }
  companyId: number
}) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'

  const form = useCustomOptionalForm(companySettingsSchema, {
    name: company.name ?? '',
    address: company.address ?? '',
    logo_height: company.logo_height ?? DEFAULT_COMPANY_LOGO_HEIGHT,
    state_taxes: company.state_taxes,
  })

  return (
    <PageLayout title='Company'>
      <MultiPartForm
        form={form}
        className='max-w-lg space-y-4 rounded-lg bg-white p-5 shadow-[0px_0px_5px_rgba(0,0,0,0.15)]'
      >
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <InputItem name='Company name' placeholder='Company name' field={field} />
          )}
        />
        <AddressInput form={form} field='address' label='Company address' />
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <CompanyLogoInput currentLogoUrl={company.logo_url} field={field} />
          )}
        />
        <FormField
          control={form.control}
          name='state_taxes'
          render={({ field }) => (
            <InputItem
              name='Sales Tax (%)'
              placeholder='7'
              type='number'
              field={{
                ...field,
                value: field.value ?? '',
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  const value = event.target.value
                  field.onChange(value === '' ? null : Number(value))
                },
              }}
            />
          )}
        />

        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-medium text-slate-700'>
            Company ID : {companyId}
          </label>
        </div>

        <LoadingButton loading={isSubmitting}>Save</LoadingButton>
      </MultiPartForm>
    </PageLayout>
  )
}

export function HydrateFallback() {
  return (
    <PageLayout title='Company'>
      <div className='max-w-lg space-y-4 rounded-lg bg-white p-5 shadow-[0px_0px_5px_rgba(0,0,0,0.15)]'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-10 w-full' />
        <div className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-4 w-32' />
        </div>
        <Skeleton className='h-10 w-20' />
      </div>
    </PageLayout>
  )
}
