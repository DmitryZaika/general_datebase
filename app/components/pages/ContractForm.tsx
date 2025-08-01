import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  Form,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { AddressInput } from '~/components/organisms/AddressInput'
import { RoomSubForm } from '~/components/organisms/RoomSubForm'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormProvider } from '~/components/ui/form'
import { Switch } from '~/components/ui/switch'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { customerSchema, roomSchema, type TCustomerSchema } from '~/schemas/sales'
import type { Faucet, Sink } from '~/types'
import { roomPrice } from '~/utils/contracts'
import { CustomerSearch } from '../molecules/CustomerSearch'
import { FullDynamicAdditions } from '../molecules/DynamicAdditions'

const resolver = zodResolver(customerSchema)

interface IContractFormProps {
  starting: Partial<TCustomerSchema>
  saleId?: number
  companyId: number
}

const fetchSinkType = async (): Promise<Sink[]> => {
  const url = `/api/sinkType`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data = await response.json()
  return data
}

const fetchFaucetType = async (): Promise<Faucet[]> => {
  const url = `/api/allFaucets`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data = await response.json()
  return data
}

export function ContractForm({ starting, saleId, companyId }: IContractFormProps) {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const location = useLocation()
  const { data: sink_type = [] } = useQuery({
    queryKey: ['sink_type'],
    queryFn: fetchSinkType,
  })
  const { data: faucet_type = [] } = useQuery({
    queryKey: ['faucet_type'],
    queryFn: fetchFaucetType,
  })

  const form = useForm<TCustomerSchema>({
    resolver,
    defaultValues: starting,
  })

  const fullSubmit = useFullSubmit(form, undefined, 'POST', value => {
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return value
  })

  const handleAddRoom = () => {
    const currentRooms = form.getValues('rooms')
    const newRoom = roomSchema.parse({
      edge: 'flat',
      tear_out: 'no',
      stove: 'f/s',
      waterfall: 'no',
      seam: 'standard',
    })
    newRoom.slabs = []

    form.setValue('rooms', [...currentRooms, newRoom])
  }

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }

  useEffect(() => {
    const address = form.watch('same_address')
    if (address) {
      form.setValue('project_address', form.getValues('billing_address'))
    }
  }, [form.watch('same_address')])

  const roomValues = form.watch('rooms')
  const extrasValues = form.watch('extras') || []

  const totalRoomPrice = useMemo(() => {
    let total = 0
    roomValues.forEach(room => {
      total += roomPrice(room, sink_type, faucet_type)
    })
    extrasValues.forEach(extra => {
      total += Number(extra.price)
    })
    return total
  }, [
    JSON.stringify(roomValues),
    JSON.stringify(sink_type),
    JSON.stringify(faucet_type),
    JSON.stringify(extrasValues),
  ])
  form.setValue('price', totalRoomPrice)

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='contractForm' onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
            <div className=''>
              <CustomerSearch form={form} companyId={companyId} />
              <div className='flex items-center space-x-2 my-2'>
                <FormField
                  control={form.control}
                  name='same_address'
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id='same_address'
                        label='Project address same as billing address'
                      />
                    </>
                  )}
                />
              </div>

              {!form.watch('same_address') && (
                <AddressInput form={form} field='project_address' type='project' />
              )}

              {form.watch('rooms').map((room, index) => (
                <RoomSubForm
                  key={index}
                  form={form}
                  index={index}
                  sink_type={sink_type}
                  faucet_type={faucet_type}
                />
              ))}

              <div className='flex mt-4'>
                <Button type='button' variant='blue' size='sm' onClick={handleAddRoom}>
                  <Plus className='h-3 w-3' /> Add Room
                </Button>
              </div>

              <FullDynamicAdditions form={form} name='extras' />

              <div className='flex flex-row gap-2 mt-6'>
                <FormField
                  control={form.control}
                  name='notes_to_sale'
                  render={({ field }) => (
                    <InputItem
                      name={'Notes'}
                      placeholder={'Notes to Sale'}
                      field={field}
                      formClassName='mb-0 w-3/4'
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name='price'
                  render={({ field }) => (
                    <InputItem
                      name='Price'
                      placeholder='Price'
                      field={field}
                      disabled={true} // только чтение, но значение отправится
                      formClassName='mb-0 w-3/4'
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className='flex flex-col sm:flex-row gap-2  mt-4'>
              {saleId && (
                <Link
                  to={{
                    pathname: 'unsell',
                    search: location.search,
                  }}
                >
                  <Button variant='destructive' type='button'>
                    Unsell
                  </Button>
                </Link>
              )}
              <LoadingButton
                loading={isSubmitting}
                className='sm:order-2 order-1 sm:ml-auto ml-0'
                type='submit'
              >
                Submit
              </LoadingButton>
            </DialogFooter>
          </Form>
          <Outlet />
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
