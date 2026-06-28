import { Link, useLoaderData } from 'react-router'
import {
  GraniteManagerMarketingBackground,
  GraniteManagerMarketingHeader,
  useGraniteManagerCalendly,
} from '~/components/organisms/GraniteManagerMarketingShell'
import { getCompanyLogoUrl } from '~/constants/logos'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

const CUSTOMER_COMPANY_IDS = [1, 3, 7]

export const loader = async () => {
  const placeholders = CUSTOMER_COMPANY_IDS.map(() => '?').join(',')
  const rows = await selectMany<{ id: number; name: string; logo_url: string | null }>(
    db,
    `SELECT id, name, logo_url FROM company WHERE id IN (${placeholders}) ORDER BY id`,
    CUSTOMER_COMPANY_IDS,
  )
  return {
    companies: rows.map(row => ({
      id: row.id,
      name: row.name,
      logo: row.logo_url?.trim() || getCompanyLogoUrl(row.id),
    })),
  }
}

export default function CustomersCompanies() {
  const { companies } = useLoaderData<typeof loader>()
  const openDemo = useGraniteManagerCalendly()

  return (
    <GraniteManagerMarketingBackground fillViewport>
      <GraniteManagerMarketingHeader onDemo={openDemo} />
      <div className='flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto px-4 py-8 pt-30'>
        <h1 className='text-center text-2xl font-bold tracking-tight text-slate-900'>
          Choose your company
        </h1>
        <p className='mt-2 text-center text-sm text-slate-600'>
          Select a location to browse stones and products
        </p>
        <div className='mt-10 flex flex-wrap items-start justify-center gap-8'>
          {companies.map(company => (
            <Link
              key={company.id}
              to={`/customer/${company.id}/stones`}
              className='flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm transition-colors hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2'
            >
              <img
                src={company.logo}
                alt={company.name}
                className='h-24 w-auto max-w-[200px] object-contain'
              />
              <span className='text-sm font-bold text-slate-800'>{company.name}</span>
            </Link>
          ))}
        </div>
        <Link
          to='/login'
          className='mt-10 text-sm font-medium text-slate-600 underline hover:text-slate-900'
        >
          For Employees
        </Link>
      </div>
    </GraniteManagerMarketingBackground>
  )
}
