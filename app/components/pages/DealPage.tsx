import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Outlet,
  useLocation,
  useNavigate
} from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { DealsDialogSchema } from '~/schemas/deals'


async function fetchDealInfoById(dealId: number): Promise<DealsDialogSchema | null> {
    const res = await fetch(`/api/deals/${dealId}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.deal
  }

export default function DealsEdit() {
  const navigate = useNavigate()
  const location = useLocation()
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`)
    }
   const queryClient = useQueryClient()
    const { data: currentDeal } = useQuery({
      queryKey: ['deal-by-id', Number(location.pathname.split('/').pop())],
      queryFn: () => fetchDealInfoById(Number(location.pathname.split('/').pop())),
      enabled: !!Number(location.pathname.split('/').pop()),
    })

    const { mutate } = useMutation({
        mutationFn: fetchDealInfoById,
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['deal-by-id', Number(location.pathname.split('/').pop())] })
          },
      })

  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-125 overflow-auto flex flex-col justify-baseline min-h-[390px] max-h-[95vh] p-5'>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
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
