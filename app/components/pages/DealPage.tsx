import { Outlet, useLocation, useNavigate, useNavigation } from 'react-router'
import { DealActivityPanel } from '~/components/molecules/DealActivityPanel'
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
      navigate(`${dealsBase}${location.search}`, { state: { shouldRevalidate: true } })
    }
  }

  const showProgress =
    stages && stages.length > 0 && history && currentListId !== undefined

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[1100px] xl:max-w-[1200px] overflow-auto md:overflow-hidden flex flex-col justify-baseline h-auto min-h-[600px] max-h-[95vh] md:h-[95vh] py-4 px-1 sm:px-2 sm:py-5'>
        <DialogHeader>
          <DialogTitle className='px-1 sm:px-2'>Edit Deal</DialogTitle>
        </DialogHeader>
        {showProgress && (
          <div className='mb-2'>
            <DealProgressBar
              stages={stages}
              history={history}
              currentListId={currentListId}
              isClosed={isClosed}
              closedAt={closedAt}
            />
          </div>
        )}
        <div className='grid grid-cols-1 md:grid-cols-[2fr_2fr] flex-1 min-h-0 overflow-auto md:overflow-hidden'>
          <div className='px-1 sm:px-1 md:overflow-auto md:min-h-0'>
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
          <div className='border-t md:border-t-0 md:border-l pt-4 md:pt-0 px-1 sm:px-2 pr-2 md:overflow-auto md:min-h-0'>
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
      </DialogContent>
    </Dialog>
  )
}
