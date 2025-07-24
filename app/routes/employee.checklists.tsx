import { LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { getEmployeeUser } from '~/utils/session.server'
import { cn } from '~/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useIsMobile } from '~/hooks/use-mobile'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

interface ChecklistItem {
  id: number
  customer_name: string
  installation_address: string
  material_correct: boolean
  seams_satisfaction: boolean
  appliances_fit: boolean
  backsplashes_correct: boolean
  edges_correct: boolean
  holes_drilled: boolean
  cleanup_completed: boolean
  comments: string | null
  created_at: string
  installer_name: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const query = `
    SELECT 
      c.id,
      c.customer_name,
      c.installation_address,
      c.material_correct,
      c.seams_satisfaction,
      c.appliances_fit,
      c.backsplashes_correct,
      c.edges_correct,
      c.holes_drilled,
      c.cleanup_completed,
      c.comments,
      c.created_at,
      u.name as installer_name
    FROM checklists c
    LEFT JOIN users u ON c.installer_id = u.id
    ORDER BY c.created_at DESC
  `

  const items = await selectMany<ChecklistItem>(db, query)
  return { items }
}

export default function EmployeeChecklists() {
  const { items } = useLoaderData<typeof loader>()
  const isMobile = useIsMobile()

  return (
    <div className='p-4 mx-auto max-w-4xl'>
      <h1 className='text-2xl font-semibold mb-4'>Post-installation Checklists</h1>
      {items.length === 0 ? (
        <p>No checklists found.</p>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3',
          )}
        >
          {items.map(item => (
            <Card key={item.id} className='hover:shadow-lg transition-shadow'>
              <CardHeader>
                <CardTitle className='text-sm'>{item.customer_name}</CardTitle>
                <p className='text-xs text-gray-600'>
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
                {item.installer_name && (
                  <p className='text-xs text-gray-500'>
                    Installer: {item.installer_name}
                  </p>
                )}
              </CardHeader>
              <CardContent className='space-y-2'>
                <p className='text-sm'>
                  <strong>Address:</strong> {item.installation_address}
                </p>

                <div className='text-xs space-y-1'>
                  <p>
                    <span
                      className={
                        item.material_correct ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {item.material_correct ? '✓' : '✗'}
                    </span>{' '}
                    Material correct
                  </p>
                  <p>
                    <span
                      className={
                        item.seams_satisfaction ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {item.seams_satisfaction ? '✓' : '✗'}
                    </span>{' '}
                    Seams satisfaction
                  </p>
                  <p>
                    <span
                      className={
                        item.appliances_fit ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {item.appliances_fit ? '✓' : '✗'}
                    </span>{' '}
                    Appliances fit
                  </p>
                  <p>
                    <span
                      className={
                        item.cleanup_completed ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {item.cleanup_completed ? '✓' : '✗'}
                    </span>{' '}
                    Cleanup completed
                  </p>
                </div>

                {item.comments && (
                  <div className='mt-2'>
                    <p className='text-xs font-medium'>Comments:</p>
                    <p className='text-xs text-gray-700'>{item.comments}</p>
                  </div>
                )}

                <a
                  href={`/api/checklist-pdf/${item.id}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-block text-blue-600 hover:underline text-sm mt-2'
                >
                  View PDF
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
