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

interface DealPageProps {
  dealId: number
  stages?: { id: number; name: string; position: number }[]
  history?: { list_id: number; entered_at: string; exited_at: string | null }[]
  currentListId?: number
  activities?: DealActivity[]
  isWon?: number | null
}

export default function DealsEdit({
  dealId,
  stages,
  history,
  currentListId,
  activities,
  isWon,
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
      <DialogContent className='sm:max-w-[1100px] overflow-auto md:overflow-hidden flex flex-col justify-baseline h-auto min-h-[600px] max-h-[95vh] md:h-[85vh] p-5'>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        {showProgress && (
          <div className='mb-2'>
            <DealProgressBar
              stages={stages}
              history={history}
              currentListId={currentListId}
              isClosed={isWon !== null && isWon !== undefined}
            />
          </div>
        )}
        <div className='grid grid-cols-1 md:grid-cols-[1.75fr_2fr] flex-1 min-h-0 overflow-auto md:overflow-hidden'>
          <div className='pl-2 pr-2 md:pr-4 md:overflow-auto md:min-h-0'>
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
          <div className='border-t md:border-t-0 md:border-l pt-4 md:pt-0 pl-2 md:pl-4 pr-2 md:overflow-auto md:min-h-0'>
            <DealActivityPanel dealId={dealId} activities={activities} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
