import { useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  getScheduledEmailsByCompany,
  type ScheduledEmailStatus,
} from '~/crud/scheduledEmails'
import { db } from '~/db.server'
import { getAdminUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const scheduledEmails = await getScheduledEmailsByCompany(db, user.company_id)

  return { scheduledEmails }
}

const STATUS_BADGE_MAP: Record<
  ScheduledEmailStatus,
  { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

const ALL_STATUSES: ScheduledEmailStatus[] = ['pending', 'sent', 'failed', 'cancelled']

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ScheduledEmails() {
  const { scheduledEmails } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  const filtered = scheduledEmails.filter(email => {
    const matchesSearch = email.customer_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || email.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <>
      <Dialog open={true} onOpenChange={handleChange}>
        <DialogContent className='sm:max-w-[900px] h-[600px] flex flex-col'>
          <DialogHeader>
            <DialogTitle>Scheduled Emails</DialogTitle>
          </DialogHeader>

          <div className='flex items-center gap-4 mb-4'>
            <Input
              placeholder='Search by customer...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='flex-1'
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-[140px]'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                {ALL_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {STATUS_BADGE_MAP[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex-1 overflow-auto'>
            {!filtered.length ? (
              <div className='flex items-center justify-center h-full text-gray-500'>
                {searchTerm || statusFilter !== 'all'
                  ? 'No scheduled emails found'
                  : 'No scheduled emails yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Send At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='w-[80px]' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(email => {
                    const badgeConfig = STATUS_BADGE_MAP[email.status]
                    return (
                      <TableRow key={email.id}>
                        <TableCell className='font-medium'>
                          {email.customer_name}
                        </TableCell>
                        <TableCell>{email.template_name}</TableCell>
                        <TableCell>{formatDateTime(email.send_at)}</TableCell>
                        <TableCell>
                          <Badge variant={badgeConfig.variant}>
                            {badgeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {email.status === 'pending' && (
                            <Link to={`cancel/${email.id}${location.search}`}>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='text-red-500 hover:text-red-700'
                              >
                                Cancel
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Outlet />
    </>
  )
}
