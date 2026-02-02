import { Outlet, useLocation, useNavigate } from 'react-router'
import { DealProgressBar } from '~/components/molecules/DealProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'

interface DealPageProps {
  stages?: { id: number; name: string; position: number }[]
  history?: { list_id: number; entered_at: string; exited_at: string | null }[]
  currentListId?: number
}

export default function DealsEdit({
  stages,
  history,
  currentListId,
}: DealPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  const showProgress =
    stages && stages.length > 0 && history && currentListId !== undefined

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-125 overflow-auto flex flex-col justify-baseline min-h-[390px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        {showProgress && (
          <div className='mb-2'>
            <DealProgressBar
              stages={stages}
              history={history}
              currentListId={currentListId}
            />
          </div>
        )}
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
      </DialogContent>
    </Dialog>
  )
}
