import { Outlet, useLocation, useNavigate } from 'react-router'
import { DealActivityPanel } from '~/components/molecules/DealActivityPanel'
import { DealProgressBar } from '~/components/molecules/DealProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { DealActivity } from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'

interface DealPageProps {
  dealId: number
  stages?: { id: number; name: string; position: number }[]
  history?: { list_id: number; entered_at: string; exited_at: string | null }[]
  currentListId?: number
  isClosed?: boolean
  isWon?: number | null
  closedAt?: string | null
  activities?: DealActivity[]
  notes?: DealNote[]
}

export default function DealsEdit({
  dealId,
  stages,
  history,
  currentListId,
  isClosed,
  isWon,
  closedAt,
  activities,
  notes,
}: DealPageProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = (open: boolean) => {
    if (!open) {
      const basePath = location.pathname.includes('/admin/')
        ? '/admin/deals'
        : '/employee/deals'
      navigate(`${basePath}${location.search}`, { state: { shouldRevalidate: true } })
    }
  }

  const showProgress =
    stages && stages.length > 0 && history && currentListId !== undefined

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[1100px] overflow-auto md:overflow-hidden flex flex-col justify-baseline h-auto min-h-[600px] max-h-[95vh] md:h-[85vh] py-4 px-1 sm:px-2 sm:py-5'>
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
              isWon={isWon}
              closedAt={closedAt}
            />
          </div>
        )}
        <div className='grid grid-cols-1 md:grid-cols-[2fr_2fr] flex-1 min-h-0 overflow-auto md:overflow-hidden'>
          <div className='px-1 sm:px-1 md:overflow-auto md:min-h-0'>
            <Tabs
              value={location.pathname.split('/').pop()}
              onValueChange={value => navigate(`${value}${location.search}`)}
            >
              <TabsList className='mb-5 grid grid-cols-5'>
                <TabsTrigger value='project'>Project</TabsTrigger>
                <TabsTrigger value='information'>General</TabsTrigger>
                <TabsTrigger value='images'>Images</TabsTrigger>
                <TabsTrigger value='documents'>Documents</TabsTrigger>
                <TabsTrigger value='history'>Email</TabsTrigger>
              </TabsList>
              <Outlet />
            </Tabs>
          </div>
          <div className='border-t md:border-t-0 md:border-l pt-4 md:pt-0 px-1 sm:px-2 pr-2 md:overflow-auto md:min-h-0'>
            <DealActivityPanel dealId={dealId} activities={activities} notes={notes} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
