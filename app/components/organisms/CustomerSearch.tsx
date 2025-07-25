import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Path, UseFormReturn } from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import { InputItem } from '~/components/molecules/InputItem'
import { Button } from '~/components/ui/button'
import { FormField } from '~/components/ui/form'
import type { Customer } from '~/types'

interface Props<TFormValues extends Record<string, unknown>> {
  form: UseFormReturn<TFormValues>
  nameField?: Path<TFormValues> // default "name"
  idField?: Path<TFormValues> // default "customer_id"
}

export function CustomerSearch<T extends Record<string, unknown>>({
  form,
  nameField = 'name' as Path<T>,
  idField = 'customer_id' as Path<T>,
}: Props<T>) {
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const searchTerm = String(form.watch(nameField as Path<T>) ?? '')
  const [debounced] = useDebounce(searchTerm, 300)

  const fetchCustomers = async (term: string): Promise<Customer[]> => {
    if (!term) return []
    const res = await fetch(`/api/customers/search?term=${encodeURIComponent(term)}`)
    if (!res.ok) throw new Error('Failed to fetch customers')
    const data = (await res.json()) as { customers: Customer[] }
    return data.customers?.slice(0, 10) ?? []
  }

  const { data: suggestions = [] } = useQuery({
    queryKey: ['customer-search', debounced],
    queryFn: () => fetchCustomers(debounced),
    enabled: debounced.length > 1,
  })

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue(nameField, e.target.value)
    if (!showSuggestions) setShowSuggestions(true)
    if (isExistingCustomer) {
      setIsExistingCustomer(false)
      form.setValue(idField, undefined)
    }
  }

  const handleSelect = (customer: Customer) => {
    form.setValue(nameField, customer.name, { shouldValidate: true })
    form.setValue(idField, customer.id, { shouldValidate: true })
    setIsExistingCustomer(true)
    setShowSuggestions(false)
  }

  return (
    <div className='relative'>
      <FormField
        control={form.control}
        name={nameField}
        render={({ field }) => (
          <InputItem
            name='Customer Name'
            placeholder='Enter customer name'
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
              form.setValue(idField, undefined)
            }}
          >
            <X className='h-2 w-2' />
          </Button>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className='absolute z-10 w-full -mt-3 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg'
        >
          <ul className='py-1 divide-y divide-gray-200'>
            {suggestions.map(c => (
              <li
                key={c.id}
                className='px-2 py-1 hover:bg-gray-50 cursor-pointer'
                onClick={() => handleSelect(c)}
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
