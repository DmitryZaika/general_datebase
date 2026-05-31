import {
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
  useOutletContext,
} from 'react-router'
import { DealActivityPanel } from '~/components/molecules/DealActivityPanel'
import { DealEditDialogClose } from '~/components/molecules/DealEditDialogClose'
import { DealProgressBar } from '~/components/molecules/DealProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type { DealEmailHistoryItem } from '~/types/dealActivityTypes'
import type { Nullable } from '~/types/utils'
import {
  DEAL_EDIT_DIALOG_CLASS,
  type DealsBoardOutletContext,
} from '~/utils/dealsBoardShell'

interface DealPageProps {
  dealId: number
  stages?: { id: number; name: string; position: number }[]
  history?: { list_id: number; entered_at: string; exited_at: Nullable<string> }[]
  currentListId?: number
  isClosed?: boolean
  closedAt?: Nullable<string>
  activities?: DealActivity[]
  notes?: DealNote[]
  emails?: DealEmailHistoryItem[]
  customerEmails?: DealEmailHistoryItem[]
  imagesCount?: number
  documentsCount?: number
  currentUserName?: string
}

function DealEditOutletSkeleton() {
  return (
    <div className='space-y-3' aria-hidden>
      <Skeleton className='h-9 w-full max-w-lg' />
      <Skeleton className='h-9 w-full max-w-lg' />
      <Skeleton className='h-36 w-full' />
      <Skeleton className='h-9 w-2/3 max-w-md' />
    </div>
  )
}

export default function DealsEdit({
  dealId,
  stages,
  history,
  currentListId,
  isClosed,
  closedAt,
  activities,
  notes,
  emails,
  customerEmails,
  imagesCount = 0,
  documentsCount = 0,
  currentUserName = '',
}: DealPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigation = useNavigation()
  const outletContext = useOutletContext<DealsBoardOutletContext | null>()
  const embedded = outletContext?.dealEditEmbedded === true
  const dealsBase = location.pathname.includes('/admin/')
    ? '/admin/deals'
    : '/employee/deals'

  const dealEditTabMatch = location.pathname.match(
    /\/edit\/[^/]+\/(project|information|images|documents)(?:\/|$)/,
  )
  const activeDealTab = dealEditTabMatch?.[1] ?? 'project'

  const navPath = navigation.location?.pathname ?? ''
  const showOutletSkeleton =
    navigation.state === 'loading' &&
    navPath.includes(`/edit/${dealId}/`) &&
    navPath !== location.pathname

  const handleChange = (open: boolean) => {
    if (!open) {
      outletContext?.dismissDealEdit?.()
      navigate(`${dealsBase}${location.search}`, { replace: true })
    }
  }

  const showProgress =
    stages && stages.length > 0 && history && currentListId !== undefined

  const pageInner = (
    <>
      <div className='shrink-0'>
        <div className='flex items-center justify-between gap-3 px-1 sm:px-2'>
          <DialogHeader className='space-y-0 text-left'>
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <DealEditDialogClose />
        </div>
        {showProgress ? (
          <div className='mb-2 px-1 pt-2'>
            <DealProgressBar
              stages={stages}
              history={history}
              currentListId={currentListId}
              isClosed={isClosed}
              closedAt={closedAt}
            />
          </div>
        ) : null}
      </div>
      <div className='grid min-h-0 flex-1 grid-cols-1 overflow-auto md:overflow-hidden md:grid-cols-[2fr_2fr]'>
        <div className='px-1 sm:px-1 md:min-h-0 md:overflow-auto'>
          <Tabs
            value={activeDealTab}
            onValueChange={value =>
              navigate(`${dealsBase}/edit/${dealId}/${value}${location.search}`)
            }
          >
            <TabsList className='mb-5 grid grid-cols-4'>
              <TabsTrigger value='project'>Project</TabsTrigger>
              <TabsTrigger value='information'>General</TabsTrigger>
              <TabsTrigger value='images'>
                Images
                {imagesCount > 0 ? (
                  <span className='ml-1 rounded-full bg-zinc-200 px-1.5 py-0 text-[10px] font-semibold leading-4 text-zinc-700'>
                    {imagesCount}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value='documents'>
                Documents
                {documentsCount > 0 ? (
                  <span className='ml-1 rounded-full bg-zinc-200 px-1.5 py-0 text-[10px] font-semibold leading-4 text-zinc-700'>
                    {documentsCount}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
            {showOutletSkeleton ? <DealEditOutletSkeleton /> : <Outlet />}
          </Tabs>
        </div>
        <div className='border-t px-1 pt-4 sm:px-2 pr-2 md:min-h-0 md:border-l md:border-t-0 md:overflow-auto md:pt-0'>
          <DealActivityPanel
            dealId={dealId}
            activities={activities}
            notes={notes}
            emails={emails}
            customerEmails={customerEmails}
            currentUserName={currentUserName}
          />
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className='flex h-full min-h-0 flex-col overflow-hidden'>{pageInner}</div>
    )
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent hideClose className={DEAL_EDIT_DIALOG_CLASS}>
        {pageInner}
      </DialogContent>
    </Dialog>
  )
}
