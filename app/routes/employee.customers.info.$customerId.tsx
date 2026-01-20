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
import { db } from '~/db.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

type CustomerInfo = {
  id: number
  name: string
  email: string | null
  phone: string | null
  phone_2: string | null
  address: string | null
  sales_rep_name: string | null
  source: string | null
  created_at: string | null
  parent_id: number | null
  company_name: string | null
}

type DealRow = {
  id: number
  amount: number | null
  description: string | null
  lost_reason: string | null
  list_name: string
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
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const customerId = params.customerId ? Number(params.customerId) : 0
  if (!customerId || !Number.isFinite(customerId)) {
    return redirect('..')
  }

  const url = new URL(request.url)
  if (url.pathname.endsWith(params.customerId!)) {
    return redirect(`${url.pathname}/info${url.search}`)
  }

  const customer = await selectId<CustomerInfo>(
    db,
    `SELECT c.id, c.name, c.email, c.phone, c.phone_2, c.address, u.name AS sales_rep_name, c.source, c.parent_id, c.company_name
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
    `SELECT d.id, d.amount, d.description, d.lost_reason, l.name AS list_name
     FROM deals d
     JOIN deals_list l ON l.id = d.list_id
     WHERE d.customer_id = ? AND d.deleted_at IS NULL AND l.deleted_at IS NULL
     ORDER BY d.id DESC`,
    [customerId],
  )

  return { customer, deals, project, hasTabs: !!customer?.company_name || hasChildren.length > 0 }
}

export default function CustomerInfoDialog() {
  const navigate = useNavigate()
  const location = useLocation()
  const { customer, deals, project, hasTabs } = useLoaderData<typeof loader>() as {
    customer: CustomerInfo | null
    deals: DealRow[]
    project: ProjectInfo | null
    hasTabs: boolean
  }

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
              <Outlet context={{ customer, deals, project }} />
            </div>
          </Tabs>
        ) : (
          <div className='mt-4'>
            <Outlet context={{ customer, deals, project }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
