/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type {
  FieldPathValue,
  FieldValues,
  Path,
  PathValue,
  UseFormReturn,
} from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import { Spinner } from '~/components/atoms/Spinner'
import { Command, CommandGroup, CommandItem } from '~/components/ui/command'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import type { FinalSuggestion } from '~/services/types'

function replaceZipCode(address: string, zipCode: string) {
  if (!address || !zipCode) return address
  if (address.includes(zipCode)) return address
  return address.replace(/,\s*USA\s*$/i, `, ${zipCode}`)
}

function zipFromAddress(address: string): string {
  const match = address.match(/,\s*(\d{5}(?:-\d{4})?)\s*$/)
  return match?.[1] ?? ''
}

function effectiveZip(zipFieldValue: string, address: string): string {
  if (zipFieldValue) return zipFieldValue
  return zipFromAddress(address)
}

async function fetchPlaceZip(placeId: string): Promise<string> {
  const res = await fetch(
    `/api/google/place-details?place_id=${encodeURIComponent(placeId)}`,
  )
  if (!res.ok) return ''
  const json: { zip_code?: string } = await res.json()
  return json.zip_code ?? ''
}

async function completeAddress(
  q: string,
  signal?: AbortSignal,
): Promise<FinalSuggestion[]> {
  const res = await fetch(`/api/google/address-complete?q=${encodeURIComponent(q)}`, {
    signal,
  })
  if (!res.ok) throw new Error('Failed to fetch address')
  return await res.json()
}

export type StringPath<T extends FieldValues> = {
  [K in Path<T>]: PathValue<T, K> extends string | null | undefined ? K : never
}[Path<T>]

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>
  field: StringPath<T>
  zipField?: StringPath<T>
  type: 'billing' | 'project'
}

export function AddressInput<T extends FieldValues>({
  form,
  field,
  zipField,
  type,
}: Props<T>) {
  const [open, setOpen] = useState(false)

  const rawValue = form.watch(field) ?? ''
  const zipFieldValue = zipField ? (form.watch(zipField) ?? '') : ''
  const resolvedZip = effectiveZip(zipFieldValue, rawValue)
  const displayValue = replaceZipCode(rawValue, resolvedZip)
  const [debounced] = useDebounce(displayValue, 150)

  const { data = [], isFetching } = useQuery({
    queryKey: ['google', 'address', debounced],
    queryFn: ({ signal }) => completeAddress(debounced, signal),
    enabled: debounced.length >= 3,
    staleTime: 60_000,
    placeholderData: previousData => previousData,
  })

  async function handleSelect(suggestion: FinalSuggestion) {
    let zip = suggestion.address.zip ?? ''
    if (!zip) {
      zip = await fetchPlaceZip(suggestion.place_id)
    }

    const addressWithZip = replaceZipCode(
      suggestion.description.text,
      zip,
    ) as FieldPathValue<T, StringPath<T>>

    form.setValue(field, addressWithZip, {
      shouldValidate: true,
      shouldDirty: true,
    })

    if (zipField) {
      form.setValue(zipField, zip as PathValue<T, StringPath<T>>, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
  }

  const toUpperCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

  const isDebouncing = open && displayValue.length >= 3 && displayValue !== debounced
  const isSearching = isFetching || isDebouncing

  return (
    <FormField
      control={form.control}
      name={field}
      render={({ field: rhf }) => (
        <FormItem className='relative'>
          <FormLabel>{`${toUpperCase(type)} Address`}</FormLabel>
          <FormControl>
            <div className='relative w-full'>
              <Input
                className={isSearching ? 'pr-9' : undefined}
                placeholder={`Enter ${toUpperCase(type)} address (min 3 characters)`}
                value={displayValue}
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
                    void handleSelect(data[0])
                    setOpen(false)
                  }
                }}
              />
              {isSearching && (
                <div className='pointer-events-none absolute inset-y-0 right-3 flex items-center'>
                  <Spinner size={16} className='text-muted-foreground' />
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />

          {open && (
            <Command className='absolute z-10 top-full mt-1 w-full h-auto max-h-40 overflow-y-auto border rounded-md bg-white shadow-md'>
              {isSearching && data.length === 0 ? (
                <div className='flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground'>
                  <Spinner size={16} />
                  Searching…
                </div>
              ) : (
                <CommandGroup heading={isSearching ? 'Searching…' : 'Suggestions'}>
                  {data.map(s => (
                    <CommandItem key={s.place_id} onSelect={() => void handleSelect(s)}>
                      {replaceZipCode(s.description.text, s.address.zip ?? '')}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </Command>
          )}
        </FormItem>
      )}
    />
  )
}
