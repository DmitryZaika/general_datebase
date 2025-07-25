/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import { Command, CommandGroup, CommandItem } from '~/components/ui/command'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'

function replaceZipCode(address: string, zipCode: string) {
  if (address.includes(zipCode)) return address
  return address.replace('USA', zipCode)
}

async function completeAddress(q: string): Promise<
  {
    description: { text: string }
    place_id: string
    zip_code: string | null
  }[]
> {
  const res = await fetch(`/api/google/address-complete?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Failed to fetch address')
  const data = await res.json()
  return data['suggestions']
}

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>
  field: Path<T>
  zipField?: Path<T>
}

export function AddressInput<T extends FieldValues>({
  form,
  field,
  zipField,
}: Props<T>) {
  const [open, setOpen] = useState(false)

  const value = form.watch(field)
  const [debounced] = useDebounce(value, 300)

  const { data = [], isFetching } = useQuery({
    queryKey: ['google', 'address', debounced],
    queryFn: () => completeAddress(debounced),
    enabled: debounced?.length >= 6,
    staleTime: 60_000,
  })

  function handleSelect(address: string, zipCode: string) {
    const addressWithZip = zipField ? replaceZipCode(address, zipCode ?? '') : address

    form.setValue(field, addressWithZip, {
      shouldValidate: true,
      shouldDirty: true,
    })

    if (zipField) {
      form.setValue(zipField, zipCode ?? '', {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
    // requestAnimationFrame(() => setOpen(false));
  }

  return (
    <FormField
      control={form.control}
      name={field}
      render={({ field: rhf }) => (
        <FormItem className='relative'>
          <FormLabel>
            {field === 'billing_address' ? 'Billing Address' : 'Project Address'}
          </FormLabel>
          <FormControl>
            <div className='relative w-full'>
              <Input
                placeholder={`Enter ${
                  field === 'billing_address' ? 'billing' : 'project'
                } address (min 10 characters)`}
                value={
                  zipField
                    ? replaceZipCode(rhf.value ?? '', form.watch(zipField) ?? '')
                    : rhf.value
                }
                onChange={e => {
                  rhf.onChange(e)
                  setOpen(true)
                }}
                onFocus={() => rhf.value && setOpen(true)}
                onBlur={() => {
                  rhf.onBlur()
                  setTimeout(() => setOpen(false), 200)
                }}
                onKeyDown={e => {
                  if (e.key === 'Tab' && open && data.length > 0) {
                    e.preventDefault()
                    handleSelect(data[0].description.text, data[0].zip_code ?? '')
                    setOpen(false)
                  }
                }}
              />
            </div>
          </FormControl>
          <FormMessage />

          {open && (
            <Command className='absolute z-10 top-full mt-1 w-full h-auto max-h-40 overflow-y-auto border rounded-md bg-white shadow-md'>
              <CommandGroup heading={isFetching ? 'Searching…' : 'Suggestions'}>
                {data.map(s => (
                  <CommandItem
                    key={s.place_id}
                    onSelect={() => handleSelect(s.description.text, s.zip_code ?? '')}
                  >
                    {replaceZipCode(s.description.text, s.zip_code ?? '')}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          )}
        </FormItem>
      )}
    />
  )
}
