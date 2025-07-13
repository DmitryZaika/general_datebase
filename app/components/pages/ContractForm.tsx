import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Form, useLocation, useNavigate, useNavigation } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { EmailInput } from '~/components/molecules/EmailInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { PhoneInput } from '~/components/molecules/PhoneInput'
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
import { useToast } from '~/hooks/use-toast'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { customerSchema, roomSchema, type TCustomerSchema } from '~/schemas/sales'
import type { Customer } from '~/types'
import { roomPrice } from '~/utils/contracts'

const resolver = zodResolver(customerSchema)

interface IContractFormProps {
  starting: Partial<TCustomerSchema>
  saleId?: number
}

const unsellSale = async (saleId: number) => {
  const response = await fetch(`/api/unsell/${saleId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error('Failed to unsell sale')
  }
  return response.json()
}

export function ContractForm({ starting, saleId }: IContractFormProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state === 'submitting'
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)
  const location = useLocation()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const [isBuilder, setIsBuilder] = useState(!!starting.company_name)
  const { data: sink_type = [] } = useQuery({
    queryKey: ['sink_type'],
    queryFn: () => fetch('/api/sinkType').then(res => res.json()),
  })
  const { data: faucet_type = [] } = useQuery({
    queryKey: ['faucet_type'],
    queryFn: () => fetch('/api/allFaucets').then(res => res.json()),
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
    let newRoom = roomSchema.parse({})

    if (currentRooms.length > 0) {
      newRoom = {
        ...newRoom,
        edge: 'flat',
        tear_out: 'no',
        stove: 'f/s',
        waterfall: 'no',
        seam: 'standard',
      }
    }

    form.setValue('rooms', [...currentRooms, newRoom])
  }

  const [disabledFields, setDisabledFields] = useState({
    phone: false,
    email: false,
    billing_address: false,
  })

  const fetchCustomers = async (customerName: string) => {
    const response = await fetch(
      '/api/customers/search?term=' + encodeURIComponent(customerName),
    )
    if (!response.ok) {
      throw new Error('Failed to fetch slabs')
    }
    const data = await response.json()
    const limitedCustomers: Customer[] = (data.customers || []).slice(0, 1)
    return limitedCustomers
  }

  const { data: customerSuggestions = [], isLoading } = useQuery({
    queryKey: ['customers', form.watch('name')],
    queryFn: () => fetchCustomers(form.watch('name')),
    enabled: !!form.watch('name'),
  })

  const unsellMutation = useMutation({
    mutationFn: (saleId: number) => {
      return unsellSale(saleId)
    },
  })

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`)
    }
  }

  const handleSelectSuggestion = (customer: {
    id: number
    name: string
    address: string | null
    phone: string | null
    email: string | null
    company_name: string | null
  }) => {
    form.setValue('name', customer.name)
    form.setValue('customer_id', customer.id)

    setIsBuilder(!!customer.company_name)
    form.setValue('company_name', customer.company_name || null)

    if (customer.address) {
      form.setValue('billing_address', customer.address)
      setDisabledFields(prev => ({ ...prev, billing_address: true }))
      if (form.getValues('same_address')) {
        form.setValue('project_address', customer.address)
      }
    } else {
      form.setValue('billing_address', '')
      setDisabledFields(prev => ({ ...prev, billing_address: false }))
    }

    if (customer.phone) {
      form.setValue('phone', customer.phone)
      setDisabledFields(prev => ({ ...prev, phone: true }))
    } else {
      setDisabledFields(prev => ({ ...prev, phone: false }))
    }

    if (customer.email) {
      form.setValue('email', customer.email)
      setDisabledFields(prev => ({ ...prev, email: true }))
    } else {
      setDisabledFields(prev => ({ ...prev, email: false }))
    }

    setIsExistingCustomer(true)
    setShowSuggestions(false)

    fetchCustomerDetails(customer.id)
  }

  const fetchCustomerDetails = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.customer) {
          form.setValue('name', data.customer.name)

          setIsBuilder(!!data.customer.company_name)
          form.setValue('company_name', data.customer.company_name || null)

          if (data.customer.address) {
            form.setValue('billing_address', data.customer.address)
            setDisabledFields(prev => ({ ...prev, billing_address: true }))

            if (form.getValues('same_address')) {
              form.setValue('project_address', data.customer.address)
            }
          } else {
            form.setValue('billing_address', '')
            setDisabledFields(prev => ({ ...prev, billing_address: false }))
          }

          if (data.customer.phone) {
            form.setValue('phone', data.customer.phone)
            setDisabledFields(prev => ({ ...prev, phone: true }))
          } else {
            form.setValue('phone', '')
            setDisabledFields(prev => ({ ...prev, phone: false }))
          }

          if (data.customer.email) {
            form.setValue('email', data.customer.email)
            setDisabledFields(prev => ({ ...prev, email: true }))
          } else {
            form.setValue('email', '')
            setDisabledFields(prev => ({ ...prev, email: false }))
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer details:', error)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('name', e.target.value)
    if (!showSuggestions) {
      setShowSuggestions(true)
    }
    if (isExistingCustomer) {
      setIsExistingCustomer(false)
      form.setValue('customer_id', undefined)
    }
  }

  // Auto-sum total price across all rooms, including extra items
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Skip if the manual price field itself is being edited
      if (name === 'price') return

      const rooms = form.getValues('rooms')
      let total = 0

      rooms.forEach(room => {
        total += roomPrice(room, sink_type, faucet_type)
      })

      // Update price if changed
      if (form.getValues('price') !== total) {
        form.setValue('price', total, { shouldValidate: total > 0 })
      }
    })

    return () => subscription.unsubscribe()
  }, [sink_type, faucet_type])

  const handleUnsell = () => {
    if (!saleId) return
    unsellMutation.mutate(saleId, {
      onSuccess: () => {
        navigate(`/employee/stones/${window.location.search}`, {
          replace: true,
        })
        toast({
          title: 'Success',
          description: 'Sale unsold',
          variant: 'success',
        })
      },
    })
  }

  const handleBuilderChange = (checked: boolean) => {
    setIsBuilder(checked)
    if (checked) return
    form.setValue('company_name', null)
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='customerForm' onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
            <div className=''>
              <div className='flex items-start gap-2'>
                <div className='flex-grow relative'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <InputItem
                        name={'Customer Name'}
                        placeholder={'Enter customer name'}
                        field={{
                          ...field,
                          disabled: isExistingCustomer,
                          onChange: handleNameChange,
                        }}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className='absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 rounded-md flex items-center gap-1'>
                      <span>Existing</span>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => {
                          setIsExistingCustomer(false)
                          form.setValue('customer_id', undefined)
                          setDisabledFields(prev => ({
                            ...prev,
                            billing_address: false,
                            phone: false,
                            email: false,
                          }))
                        }}
                      >
                        <X className='h-2 w-2' />
                      </Button>
                    </div>
                  )}

                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className='absolute z-10 w-full -mt-4 max-h-20 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg'
                    >
                      <ul className='py-1 divide-y divide-gray-200'>
                        {customerSuggestions.map(customer => (
                          <li
                            key={customer.id}
                            className='px-2 py-0.5 hover:bg-gray-50 cursor-pointer'
                            onClick={() => handleSelectSuggestion(customer)}
                          >
                            {customer.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name='customer_id'
                render={({ field }) => <input type='hidden' {...field} />}
              />

              <AddressInput
                form={form}
                field='billing_address'
                zipField='billing_zip_code'
              />
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
                <AddressInput form={form} field='project_address' />
              )}

              <div className='flex flex-row gap-2'>
                <FormField
                  control={form.control}
                  name='phone'
                  render={({ field }) => (
                    <PhoneInput
                      field={field}
                      formClassName='mb-0 w-1/2'
                      disabled={disabledFields.phone}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <EmailInput
                      field={{
                        ...field,
                        disabled: disabledFields.email,
                      }}
                      formClassName='mb-0'
                    />
                  )}
                />
              </div>

              {/* Builder checkbox */}
         
              <div className='flex items-center space-x-2 my-2'>
                    <Switch
                      checked={isBuilder}
                      onCheckedChange={handleBuilderChange}
                      id='builder_checkbox'
                        label='Builder'
                      />
                </div>
              

              {isBuilder && (
                <FormField
                  control={form.control}
                  name='company_name'
                  render={({ field }) => (
                    <InputItem
                      name={'Company Name'}
                      placeholder={'Enter company name'}
                      field={field}
                      formClassName='mb-2'
                    />
                  )}
                />
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
                  + Add Room
                </Button>
              </div>

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
                  disabled={true}
                  render={({ field }) => (
                    <InputItem
                      name={'Price'}
                      placeholder={'Price'}
                      field={field}
                      formClassName='mb-0 w-3/4'
                    />
                  )}
                />
              </div>
            </div>
         

            <DialogFooter className='flex flex-col sm:flex-row gap-2  mt-4'>
             {saleId && <Button variant="destructive" type="button" onClick={handleUnsell}
              >
                Unsell
              </Button>}
              <LoadingButton
                loading={isSubmitting}
                className='sm:order-2 order-1 sm:ml-auto ml-0'
                type='submit'
              >
                Submit
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
