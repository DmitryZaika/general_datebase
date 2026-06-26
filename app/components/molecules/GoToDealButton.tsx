import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate, useNavigation } from 'react-router'
import {
  DealChoiceList,
  parseDealOptionsFromPayload,
  readPayloadError,
} from '~/components/molecules/DealChoiceList'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useToast } from '~/hooks/use-toast'
import type { CustomerDealOption } from '~/utils/customerDeals.server'

interface GoToDealButtonProps {
  customerName: string
  customerId?: number
  customerEmail?: string
  threadDealId?: number | null
}

export function GoToDealButton({
  customerId,
  customerName,
  customerEmail,
  threadDealId = null,
}: GoToDealButtonProps) {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [routeActive, setRouteActive] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [choices, setChoices] = useState<CustomerDealOption[]>([])

  const pathPrefix = location.pathname.startsWith('/admin') ? 'admin' : 'employee'
  const buttonLoading = loading || (navigation.state !== 'idle' && routeActive)

  const closePicker = () => {
    setPickerOpen(false)
    setChoices([])
  }

  const goToDeal = (dealId: number) => {
    setLoading(true)
    setRouteActive(true)
    navigate(`/${pathPrefix}/deals/edit/${dealId}/project`)
    return true
  }

  const handleClick = async () => {
    const email = customerEmail?.trim() ?? ''
    const name = customerName.trim()
    const canLookupCustomer =
      (customerId !== undefined && customerId > 0) ||
      email.length > 0 ||
      name.length > 0

    if (!canLookupCustomer) {
      if (threadDealId !== null) {
        goToDeal(threadDealId)
        return
      }
      toast({
        title: 'Cannot open deal',
        description: 'No customer email or name to look up deals.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    let navigatingToDeal = false
    try {
      const params = new URLSearchParams()
      if (customerId !== undefined && customerId > 0) {
        params.set('customerId', String(customerId))
      }
      if (email) {
        params.set('customerEmail', email)
      }
      if (name) {
        params.set('customerName', name)
      }
      const response = await fetch(`/api/customer-deals?${params}`)
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const description = readPayloadError(payload) ?? 'Could not load deals'
        toast({ title: 'Failure', description, variant: 'destructive' })
        return
      }

      const deals = parseDealOptionsFromPayload(payload)

      if (deals.length === 0) {
        if (threadDealId !== null) {
          navigatingToDeal = goToDeal(threadDealId)
          return
        }
        toast({
          title: 'No deal found',
          description: 'There is no open deal for this customer.',
          variant: 'destructive',
        })
        return
      }
      if (deals.length === 1) {
        navigatingToDeal = goToDeal(deals[0].id)
        return
      }
      setChoices(deals)
      setPickerOpen(true)
    } catch {
      toast({
        title: 'Failure',
        description: 'Could not load deals',
        variant: 'destructive',
      })
    } finally {
      if (!navigatingToDeal) {
        setLoading(false)
      }
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <LoadingButton
              type='button'
              size='sm'
              className='shrink-0 gap-1.5'
              loading={buttonLoading}
              onClick={() => void handleClick()}
            >
              <ExternalLink className='h-4 w-4' />
              <span className='hidden sm:inline'>Go to Deal</span>
            </LoadingButton>
          </TooltipTrigger>
          <TooltipContent>Open customer deal</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog
        open={pickerOpen}
        onOpenChange={open => {
          if (!open) closePicker()
        }}
      >
        <DialogContent className='max-w-md rounded-xl'>
          <DialogHeader>
            <DialogTitle>Choose a deal</DialogTitle>
          </DialogHeader>
          <DealChoiceList
            deals={choices}
            onSelectDeal={dealId => {
              goToDeal(dealId)
              closePicker()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
