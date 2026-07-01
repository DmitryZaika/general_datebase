import { Suspense } from 'react'
import {
  Await,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
  useLoaderData,
} from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

type SurveyItem = {
  id: number
  sales_rep_name: string | null
  sales_rep_rating: number
  sales_rep_comments: string | null
  technician_rating: number
  technician_comments: string | null
  installer_name: string | null
  installation_rating: number
  installation_comments: string | null
  created_at: string
}

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Surveys' }]
}

async function loadPageData(companyId: number) {
  const items = await selectMany<SurveyItem>(
    db,
    `SELECT 
      cs.id,
      cs.sales_rep_rating,
      cs.sales_rep_comment AS sales_rep_comments,
      cs.technician_rating,
      cs.technician_comment AS technician_comments,
      cs.installation_rating,
      cs.installation_comment AS installation_comments,
      cs.created_at,
      u.name AS sales_rep_name,
      i.name AS installer_name
    FROM customer_surveys cs
    LEFT JOIN users u ON cs.sales_rep_id = u.id
    LEFT JOIN users i ON cs.installer_id = i.id
    WHERE cs.company_id = ?
    ORDER BY cs.created_at DESC`,
    [companyId],
  )

  return { items }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    const companyId = user.company_id
    return { data: loadPageData(companyId) }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

function SurveyContent({ items }: { items: SurveyItem[] }) {
  return (
    <div className='p-4 mx-auto max-w-4xl'>
      <h1 className='text-2xl font-semibold mb-4'>Customer Surveys</h1>

      {items.length === 0 ? (
        <p>No surveys found.</p>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2'>
          {items.map(item => (
            <Card key={item.id} className='hover:shadow-lg transition-shadow'>
              <CardHeader>
                <div className='flex justify-between items-start'>
                  <div>
                    <CardTitle className='text-sm'>
                      Sales rep: {item.sales_rep_name || 'Sales rep not specified'}
                    </CardTitle>
                    <CardTitle className='text-sm'>
                      Installer: {item.installer_name || 'Not specified'}
                    </CardTitle>
                  </div>
                  <p className='text-xs text-gray-600'>
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex justify-between text-sm'>
                  <span>Sales rep</span>
                  <span>{item.sales_rep_rating}/5</span>
                </div>
                {item.sales_rep_comments ? (
                  <p className='text-xs text-gray-700'>{item.sales_rep_comments}</p>
                ) : null}

                <div className='flex justify-between text-sm'>
                  <span>Technician</span>
                  <span>{item.technician_rating}/5</span>
                </div>
                {item.technician_comments ? (
                  <p className='text-xs text-gray-700'>{item.technician_comments}</p>
                ) : null}

                <div className='flex justify-between text-sm'>
                  <span>Installation team</span>
                  <span>{item.installation_rating}/5</span>
                </div>
                {item.installation_comments ? (
                  <p className='text-xs text-gray-700'>{item.installation_comments}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminSurveys() {
  const { data } = useLoaderData<typeof loader>()

  return (
    <Suspense fallback={<HydrateFallback />}>
      <Await resolve={data}>{({ items }) => <SurveyContent items={items} />}</Await>
    </Suspense>
  )
}

export function HydrateFallback() {
  return (
    <div className='p-4 mx-auto max-w-4xl'>
      <Skeleton className='h-8 w-48 mb-4' />
      <div className='grid gap-4 sm:grid-cols-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className='flex justify-between items-start'>
                <div className='space-y-2'>
                  <Skeleton className='h-4 w-40' />
                  <Skeleton className='h-4 w-32' />
                </div>
                <Skeleton className='h-3 w-20' />
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex justify-between'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-4 w-8' />
              </div>
              <Skeleton className='h-3 w-full' />
              <div className='flex justify-between'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-8' />
              </div>
              <Skeleton className='h-3 w-3/4' />
              <div className='flex justify-between'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-8' />
              </div>
              <Skeleton className='h-3 w-1/2' />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
