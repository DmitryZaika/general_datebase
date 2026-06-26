import { useEffect, useState } from 'react'
import { SearchInput } from '~/components/molecules/SearchInput'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type { Nullable } from '~/types/utils'
import { canonicalPhone10, formatPhoneForDisplay } from '~/utils/phone'
import { searchCustomers } from './service'
import type { CustomerSearchResult } from './types'

export interface SmsNewConversationDialogProps {
  open: boolean
  onClose: () => void
  onStart: (phoneDigits: string) => void
}

function customerPhoneDigits(customer: CustomerSearchResult): Nullable<string> {
  const digits = canonicalPhone10(customer.phone)
  return digits.length === 10 ? digits : null
}

function phoneDigitsFromInput(value: string): Nullable<string> {
  const digits = canonicalPhone10(value)
  return digits.length === 10 ? digits : null
}

export function SmsNewConversationDialog(props: SmsNewConversationDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [searchInFlight, setSearchInFlight] = useState(false)

  const manualPhoneDigits = phoneDigitsFromInput(searchTerm)

  useEffect(() => {
    if (!props.open) {
      setSearchTerm('')
      setResults([])
      setSearchInFlight(false)
    }
  }, [props.open])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([])
      return
    }
    setSearchInFlight(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await searchCustomers(searchTerm)
        if (!cancelled) setResults(r)
      } finally {
        if (!cancelled) setSearchInFlight(false)
      }
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchTerm])

  function startWithDigits(digits: string) {
    props.onStart(digits)
  }

  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder='Search customer by name or phone…'
          clearable
          autoFocus
          aria-label='Search customers'
        />

        <ul className='mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100'>
          {results.map(customer => {
            const digits = customerPhoneDigits(customer)
            const hasPhone = digits !== null
            return (
              <li key={customer.id}>
                <button
                  type='button'
                  disabled={!hasPhone}
                  onClick={() => {
                    if (!digits) return
                    startWithDigits(digits)
                  }}
                  className='flex w-full justify-between items-center px-2 py-2.5 text-left hover:bg-slate-50 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                >
                  <div className='min-w-0'>
                    <div className='text-sm text-slate-900 truncate'>
                      {customer.name}
                    </div>
                    <div className='text-xs text-slate-400'>
                      {hasPhone ? formatPhoneForDisplay(digits) : 'No phone on file'}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
          {searchTerm &&
            results.length === 0 &&
            !searchInFlight &&
            manualPhoneDigits && (
              <li>
                <button
                  type='button'
                  onClick={() => startWithDigits(manualPhoneDigits)}
                  className='flex w-full items-center px-2 py-2.5 text-left hover:bg-slate-50 rounded'
                >
                  <div className='min-w-0'>
                    <div className='text-sm text-slate-900'>
                      Message {formatPhoneForDisplay(manualPhoneDigits)}
                    </div>
                    <div className='text-xs text-slate-400'>
                      No matching customer — start anyway
                    </div>
                  </div>
                </button>
              </li>
            )}
          {searchTerm &&
            results.length === 0 &&
            !searchInFlight &&
            !manualPhoneDigits && (
              <li className='text-xs text-slate-400 px-2 py-3 italic'>
                No customers match — enter a valid 10-digit phone to start anyway.
              </li>
            )}
          {searchInFlight && (
            <li className='text-xs text-slate-400 px-2 py-3 italic'>Searching…</li>
          )}
          {!searchTerm && (
            <li className='text-xs text-slate-400 px-2 py-3 italic'>
              Search by customer name or phone number.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
