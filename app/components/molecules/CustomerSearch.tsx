import { useQuery } from '@tanstack/react-query'
import { Cross } from 'lucide-react'
import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { CustomerForm } from '~/components/pages/CustomerForm'
import { TCustomerSchema } from '~/schemas/sales'
import { Customer } from '~/types'
import { Button } from '../ui/button'
import { Command, CommandGroup, CommandItem } from '../ui/command'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RawSelect } from './RawSelect'

const selectOptions = ['name', 'phone', 'email'] as const
type SelectOption = (typeof selectOptions)[number]

interface CustomerSearchProps {
  form: UseFormReturn<TCustomerSchema>
  companyId: number
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

export function CustomerSearch({ form, companyId }: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<SelectOption>(selectOptions[0])
  const [currentCustomer, setCurrentCustomer] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const hasSelectedCustomer = form.watch('customer_id')

  const { data: customerSuggestions = [], isFetching } = useQuery({
    queryKey: ['customers', selectedOption, searchTerm],
    queryFn: () => fetchCustomers(searchTerm ?? '', selectedOption),
    enabled: !!selectedOption && !!searchTerm,
  })

  function handleFinal(value: number) {
    form.setValue('customer_id', value)
    const customer = customerSuggestions.find(c => c.id === value)
    setCurrentCustomer(customer?.name ?? null)
    setSearchTerm(null)
  }

  function handleDeselect() {
    form.setValue('customer_id', undefined)
    setCurrentCustomer(null)
  }

  function handleSpecial() {
    setIsOpen(true)
  }

  function handleSuccess(value: number, name: string) {
    setIsOpen(false)
    setCurrentCustomer(name)
    form.setValue('customer_id', value)
  }

  return (
    <div className='flex  gap-2 '>
      <RawSelect
        options={selectOptions}
        value={selectedOption}
        onChange={setSelectedOption}
      />
      <div className='relative flex flex-col gap-2 w-1/2'>
        <Label>Customer</Label>
        <Input
          value={searchTerm ?? currentCustomer ?? ''}
          onChange={e => setSearchTerm(e.target.value)}
        />
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
        {hasSelectedCustomer && (
          <Button onClick={handleDeselect}>
            <Cross className='w-4 h-4' />
          </Button>
        )}
      </div>
      <Button type='button' variant='ghost' onClick={handleSpecial}>
        {hasSelectedCustomer ? 'Edit' : 'Add'} Customer
      </Button>

      {isOpen && (
        <CustomerForm
          handleChange={setIsOpen}
          onSuccess={handleSuccess}
          companyId={companyId}
        />
      )}
    </div>
  )
}
