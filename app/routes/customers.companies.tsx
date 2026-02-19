import type { LoaderFunctionArgs } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import { gbColumbus, gbIndianapolis } from '~/constants/logos'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

const companies = [
  { id: 1, logo: gbIndianapolis },
  { id: 3, logo: gbColumbus },
] as const

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const rows = await selectMany<{ id: number; name: string }>(
    db,
    'SELECT id, name FROM company WHERE id IN (1, 3) ORDER BY id',
    [],
  )
  const namesById: Record<number, string> = {}
  for (const row of rows) {
    namesById[row.id] = row.name
  }
  return { namesById }
}

export default function CustomersCompanies() {
  const { namesById } = useLoaderData<typeof loader>()
  return (
    <div className='flex flex-col items-center justify-start min-h-[60vh] gap-8 p-6'>
      <h1 className='text-xl font-medium text-center'>Choose your company</h1>
      <div className='flex flex-wrap justify-center items-start gap-10'>
        {companies.map(({ id, logo }) => (
          <Link
            key={id}
            to={`/customer/${id}/stones`}
            className='flex flex-col items-center gap-3 p-6 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400'
          >
            <img
              src={logo}
              alt={namesById[id] ?? `Company ${id}`}
              className='h-24 w-auto object-contain max-w-[200px]'
            />
            <span className='text-sm text-gray-700 font-bold'>
              {namesById[id] ?? id}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
