import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { cn } from '~/lib/utils'
import type { TCustomerSchema } from '~/schemas/sales'
import type { Customer } from '~/types'
import { Button } from '../ui/button'
import { Command, CommandGroup, CommandItem } from '../ui/command'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RawSelect } from './RawSelect'

const selectOptions = ['name', 'phone', 'email'] as const
type SelectOption = (typeof selectOptions)[number]

function CustomerSearchError({
  error,
  className,
}: {
  error: string | undefined
  className?: string
}) {
  return (
    <div>
      <p
        className={cn(
          'text-[0.8rem] font-medium text-red-500 dark:text-red-900',
          className,
        )}
      >
        {error}
      </p>
    </div>
  )
}

interface CustomerSearchProps {
  form: UseFormReturn<TCustomerSchema>
  companyId: number
  source: 'check-in' | 'user-input'
}

const fetchCustomers = async (customerName: string, searchType: SelectOption) => {
  const name = encodeURIComponent(customerName)

  const url = `/api/customers/search?term=${name}&searchType=${searchType}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch slabs')
  }
  const data: { customers: Customer[] } = await response.json()
  return data.customers
}

async function fetchCustomerById(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.customer as Customer | null
}

export function CustomerSearch({ form, companyId, source }: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<SelectOption>(selectOptions[0])
  const [currentCustomer, setCurrentCustomer] = useState<string | null>(() => {
    const n = form.getValues('name') as unknown as string | undefined
    return n && n.trim() !== '' ? n : null
  })
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const selectedCustomer = form.watch('customer_id')

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (form.formState.errors.customer_id) {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      inputRef.current?.focus()
    }
  }, [form.formState.errors.customer_id])
  useEffect(() => {
    const idNum = Number(selectedCustomer)
    if (idNum && !currentCustomer) {
      fetchCustomerById(idNum).then(c => {
        if (c?.name) {
          setCurrentCustomer(c.name)
          try {
            form.setValue('name', c.name)
          } catch {
            console.error('Failed to set name', c.name)
          }
        }
      })
    }
  }, [selectedCustomer])
  const { data: customerSuggestions = [], isFetching } = useQuery({
    queryKey: ['customers', selectedOption, searchTerm],
    queryFn: () => fetchCustomers(searchTerm ?? '', selectedOption),
    enabled: !!selectedOption && !!searchTerm,
  })

  function handleFinal(value: number) {
    form.setValue('customer_id', value)
    const customer = customerSuggestions.find(c => c.id === value)
    setCurrentCustomer(customer?.name ?? null)
    if (customer?.name) {
      form.setValue('name', customer.name)
    }

    if (customer?.address) {
      form.setValue('billing_address', customer.address)
      form.setValue('project_address', customer.address)
      form.setValue('same_address', true)
    }
    setSearchTerm(null)
  }

  function handleDeselect() {
    form.setValue('customer_id', undefined)
    form.setValue('billing_address', '')
    form.setValue('project_address', '')
    setCurrentCustomer(null)
  }

  function handleSpecial() {
    setIsOpen(true)
  }

  function handleSuccess(value: number, name: string) {
    setIsOpen(false)
    setSearchTerm(null)
    setCurrentCustomer(name)
    form.setValue('customer_id', value)
  }
  console.log(currentCustomer, 'currentCustomer')
  return (
    <div className='flex items-end gap-1'>
      <div className=''>
        <RawSelect
          label='Search by'
          options={selectOptions}
          value={selectedOption}
          onChange={value => {
            setSelectedOption(value)
            setSearchTerm(null)
          }}
        />
      </div>

      <div className='relative flex flex-col gap-1'>
        <Label>Customer</Label>
        <Input
          ref={inputRef}
          placeholder='Start typing customer…'
          value={searchTerm ?? currentCustomer ?? ''}
          onChange={e => {
            setSearchTerm(e.target.value)
            if (form.formState.errors.customer_id) {
              form.clearErrors('customer_id')
            }
          }}
          disabled={!!selectedCustomer}
          autoFocus
        />
        {form.formState.errors.customer_id && (
          <CustomerSearchError
            error={form.formState.errors.customer_id.message}
            className='text-red-500'
          />
        )}
        {searchTerm && customerSuggestions.length > 0 && (
          <Command className='z-60 top-full mt-1 w-full h-auto max-h-50 overflow-y-auto border rounded-md bg-white shadow-md absolute'>
            <CommandGroup heading={isFetching ? 'Searching…' : 'Suggestions'}>
              {customerSuggestions.map(c => (
                <CommandItem key={c.id} onSelect={() => handleFinal(c.id)}>
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        )}
        {selectedCustomer && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute -top-0 right-0 z-10 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 '
            onClick={handleDeselect}
          >
            <X className='h-3 w-3' />
          </Button>
        )}
      </div>
      <Button
        type='button'
        variant='blue'
        size='sm'
        className='w-2/9 '
        onClick={handleSpecial}
      >
        {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
      </Button>

      {isOpen && (
        <CustomerForm
          handleChange={setIsOpen}
          onSuccess={handleSuccess}
          companyId={companyId}
          customerId={selectedCustomer || undefined}
          source={source}
        />
      )}
    </div>
  )
}
