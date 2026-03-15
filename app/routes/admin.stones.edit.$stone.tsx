import { Outlet, useLocation, useNavigate } from 'react-router'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { DIALOG_CONTENT_ADD_EDIT_CLASS } from '~/utils/constants'

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
      <DialogContent className={DIALOG_CONTENT_ADD_EDIT_CLASS}>
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
