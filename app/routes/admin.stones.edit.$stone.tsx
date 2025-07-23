import { Outlet, useLocation, useNavigate } from 'react-router'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'

export default function StonesEdit() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px] overflow-auto flex flex-col justify-baseline min-h-[95vh] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Edit Stone</DialogTitle>
        </DialogHeader>
        <Tabs
          value={location.pathname.split('/').pop()}
          onValueChange={value => navigate(value)}
        >
          <TabsList>
            <TabsTrigger value={`information${location.search}`}>General</TabsTrigger>
            <TabsTrigger value={`images${location.search}`}>Images</TabsTrigger>
            <TabsTrigger value={`slabs${location.search}`}>Slabs</TabsTrigger>
          </TabsList>
          <Outlet />
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
