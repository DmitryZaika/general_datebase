import { useEffect, useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { db } from '~/db.server'
import { useIsMobile } from '~/hooks/use-mobile'
import { cn } from '~/lib/utils'
import {
  getPending,
  type PendingChecklistSubmission,
} from '~/utils/offlineChecklistQueue'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

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
  let user: User
  try {
    user = await getEmployeeUser(request)
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
    WHERE c.company_id = ?
    ORDER BY c.created_at DESC
  `

  const items = await selectMany<ChecklistItem>(db, query, [user.company_id])
  return { items }
}

export default function EmployeeChecklists() {
  const { items } = useLoaderData<typeof loader>()
  const isMobile = useIsMobile()

  const [pendingSubmission, setPendingSubmission] =
    useState<PendingChecklistSubmission | null>(null)
  const [checklistItemsMounted, setChecklistItemsMounted] = useState(false)

  useEffect(() => {
    setPendingSubmission(getPending())
  }, [])

  useEffect(() => {
    if (items.length === 0) {
      setChecklistItemsMounted(false)
      return
    }
    setChecklistItemsMounted(false)
    const timer = setTimeout(() => {
      setChecklistItemsMounted(true)
    }, 200)
    return () => {
      clearTimeout(timer)
    }
  }, [items])

  return (
    <div className='p-4 mx-auto max-w-4xl'>
      <h1 className='text-2xl font-semibold mb-4'>Post-installation Checklists</h1>

      {pendingSubmission && (
        <Card className='mb-4 border-orange-400 bg-orange-50'>
          <CardHeader>
            <CardTitle className='text-sm flex items-center gap-2'>
              <span>⏳</span>
              <span>{pendingSubmission.data.customer_name}</span>
              <span className='text-xs font-normal text-orange-600'>(Pending)</span>
            </CardTitle>
            <p className='text-xs text-gray-600'>
              {new Date(pendingSubmission.timestamp).toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent>
            <p className='text-sm'>
              <strong>Address:</strong> {pendingSubmission.data.installation_address}
            </p>
            <p className='text-xs text-orange-700 mt-2'>
              This checklist is waiting to be sent when connection is restored.
            </p>
            <p className='text-xs text-gray-600 mt-1'>
              Attempts: {pendingSubmission.attempts}
            </p>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <p>No checklists found.</p>
      ) : (
        <div
          className={cn(
            'checklist-items-stagger grid gap-4',
            isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3',
          )}
        >
          <style>{`
            .checklist-items-stagger .module-item {
              opacity: ${checklistItemsMounted ? 1 : 0};
              transform: ${checklistItemsMounted ? 'translateY(0)' : 'translateY(15px)'};
              transition: opacity 0.1s ease-out, transform 0.2s ease-out;
            }
            .checklist-items-stagger .module-item:nth-child(1) { transition-delay: 0.02s; }
            .checklist-items-stagger .module-item:nth-child(2) { transition-delay: 0.04s; }
            .checklist-items-stagger .module-item:nth-child(3) { transition-delay: 0.06s; }
            .checklist-items-stagger .module-item:nth-child(4) { transition-delay: 0.08s; }
            .checklist-items-stagger .module-item:nth-child(5) { transition-delay: 0.10s; }
            .checklist-items-stagger .module-item:nth-child(6) { transition-delay: 0.12s; }
            .checklist-items-stagger .module-item:nth-child(7) { transition-delay: 0.14s; }
            .checklist-items-stagger .module-item:nth-child(8) { transition-delay: 0.16s; }
            .checklist-items-stagger .module-item:nth-child(9) { transition-delay: 0.18s; }
            .checklist-items-stagger .module-item:nth-child(10) { transition-delay: 0.20s; }
            .checklist-items-stagger .module-item:nth-child(11) { transition-delay: 0.22s; }
            .checklist-items-stagger .module-item:nth-child(12) { transition-delay: 0.24s; }
            .checklist-items-stagger .module-item:nth-child(13) { transition-delay: 0.26s; }
            .checklist-items-stagger .module-item:nth-child(14) { transition-delay: 0.28s; }
            .checklist-items-stagger .module-item:nth-child(15) { transition-delay: 0.30s; }
            .checklist-items-stagger .module-item:nth-child(16) { transition-delay: 0.32s; }
            .checklist-items-stagger .module-item:nth-child(17) { transition-delay: 0.34s; }
            .checklist-items-stagger .module-item:nth-child(18) { transition-delay: 0.36s; }
            .checklist-items-stagger .module-item:nth-child(19) { transition-delay: 0.38s; }
            .checklist-items-stagger .module-item:nth-child(20) { transition-delay: 0.40s; }
            .checklist-items-stagger .module-item:nth-child(n+21) { transition-delay: 0.42s; }
          `}</style>
          {items.map(item => (
            <Card
              key={item.id}
              className='module-item hover:shadow-lg transition-shadow'
            >
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
