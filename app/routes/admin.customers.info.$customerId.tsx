import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { getCustomerEmailsWithReads } from '~/crud/emails'
import { db } from '~/db.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

type CustomerInfo = {
  id: number
  name: string
  email: string | null
  phone: string | null
  phone_2: string | null
  address: string | null
  sales_rep_name: string | null
  source: string | null
  created_date: string | null
  created_by: string | null
  parent_id: number | null
  company_name: string | null
  first_rep_deal_created_at: string | null
}

type DealRow = {
  id: number
  amount: number | null
  lost_reason: string | null
  list_name: string
  created_at: string | null
}

type ReassignmentRow = {
  reassigned_by: string | null
  reassigned_to: string | null
  updated_at: string
}

type ProjectInfo = {
  city: string | null
  state: string | null
  postal_code: string | null
  company_name: string | null
  remodal_type: string | null
  project_size: string | null
  contact_time: string | null
  remove_and_dispose: string | null
  improve_offer: string | null
  sink: string | null
  when_start: string | null
  details: string | null
  compaign_name: string | null
  adset_name: string | null
  ad_name: string | null
  backsplash: string | null
  kitchen_stove: string | null
  your_message: string | null
  attached_file: string | null
  qbo_id: string | null
  notes: string | null
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const customerId = params.customerId ? Number(params.customerId) : 0
  if (!customerId || !Number.isFinite(customerId)) {
    return redirect('..')
  }

  const url = new URL(request.url)
  if (url.pathname.endsWith(String(customerId))) {
    return redirect(`${url.pathname}/info${url.search}`)
  }

  const customer = await selectId<Omit<CustomerInfo, 'first_rep_deal_created_at'>>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.phone_2, c.address, u.name AS sales_rep_name, c.source, c.parent_id, c.company_name, c.created_date, c.created_by
     FROM customers c
     LEFT JOIN deals d ON d.customer_id = c.id AND d.created_at IS NULL
     LEFT JOIN users u ON c.sales_rep = u.id AND u.is_deleted = 0
     WHERE c.id = ?`,
    customerId,
  )

  const hasChildren = await selectMany<{ id: number }>(
    db,
    'SELECT id FROM customers WHERE parent_id = ? LIMIT 1',
    [customerId],
  )

  const project = await selectId<ProjectInfo>(
    db,
    `SELECT c.city, c.state, c.postal_code, c.company_name,
            c.remodal_type, c.project_size, c.contact_time, c.remove_and_dispose,
            c.improve_offer, c.sink, c.when_start, c.details, c.compaign_name,
            c.adset_name, c.ad_name, c.backsplash, c.kitchen_stove,
            c.your_message, c.attached_file, c.qbo_id, c.notes
       FROM customers c
      WHERE c.id = ?`,
    customerId,
  )

  const deals = await selectMany<DealRow>(
    db,
    `SELECT d.id, d.amount, d.lost_reason, l.name AS list_name, d.created_at
     FROM deals d
     JOIN deals_list l ON l.id = d.list_id
     WHERE d.customer_id = ? AND d.deleted_at IS NULL AND l.deleted_at IS NULL
     ORDER BY d.id DESC`,
    [customerId],
  )
  const reassignments = await selectMany<ReassignmentRow>(
    db,
    `SELECT reassigned_by, reassigned_to, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at
     FROM customers_history WHERE customer_id = ? ORDER BY updated_at ASC, id ASC`,
    [customerId],
  )
  // Temporary: assignment time for the sales-manager lead line is inferred from the first deal
  // for this customer where deal.user_id matches customer.sales_rep. Replace when history stores it.
  const firstRepDealRows = await selectMany<{ t: string }>(
    db,
    `SELECT DATE_FORMAT(d.created_at, '%Y-%m-%dT%H:%i:%sZ') AS t
     FROM deals d
     INNER JOIN customers c ON c.id = d.customer_id AND c.sales_rep = d.user_id
     WHERE d.customer_id = ? AND d.deleted_at IS NULL
     ORDER BY d.created_at ASC, d.id ASC
     LIMIT 1`,
    [customerId],
  )
  const firstRepDealAt = firstRepDealRows[0]?.t ?? null
  const companyRow = await selectId<{ company_id: number }>(
    db,
    'SELECT company_id FROM customers WHERE id = ?',
    customerId,
  )
  const customerOut: CustomerInfo | undefined =
    customer === undefined
      ? undefined
      : { ...customer, first_rep_deal_created_at: firstRepDealAt }

  const emails =
    customerOut?.email && companyRow
      ? await getCustomerEmailsWithReads(customerOut.email, companyRow.company_id)
      : []

  return {
    customer: customerOut,
    deals,
    project,
    emails,
    reassignments,
    hasTabs: !!(customerOut?.company_name || hasChildren.length > 0),
  }
}

export default function CustomerInfoDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { customer, deals, project, emails, reassignments, hasTabs } =
    useLoaderData<typeof loader>()

  const handleChange = (open: boolean) => {
    if (open === false) navigate(`..${location.search}`)
  }

  const currentTab = location.pathname.split('/').pop() || 'info'

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[560px] overflow-auto flex flex-col justify-baseline min-h-[95vh] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Customer Information</DialogTitle>
        </DialogHeader>

        {hasTabs ? (
          <Tabs
            value={currentTab}
            onValueChange={value => navigate(`${value}${location.search}`)}
            className='w-full'
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='info'>Company info</TabsTrigger>
              <TabsTrigger value='projects'>Projects</TabsTrigger>
            </TabsList>
            <div className='mt-4'>
              <Outlet context={{ customer, deals, project, emails, reassignments }} />
            </div>
          </Tabs>
        ) : (
          <div className='mt-4'>
            <Outlet context={{ customer, deals, project, emails, reassignments }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
