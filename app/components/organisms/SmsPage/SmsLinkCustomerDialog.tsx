import { Search, UserPlus } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SearchInput } from '~/components/molecules/SearchInput'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { Nullable } from '~/types/utils'
import { formatPhoneForDisplay } from '~/utils/phone'
import {
  createCustomerForPhone,
  linkExistingCustomer,
  searchCustomers,
} from './service'
import type { MockCustomer } from './types'

export interface SmsLinkCustomerDialogProps {
  open: boolean
  phoneDigits: string
  onClose: () => void
  onLinked: () => void
}

type Tab = 'existing' | 'new'

export function SmsLinkCustomerDialog(props: SmsLinkCustomerDialogProps) {
  const newNameId = useId()
  const csrfToken = useAuthenticityToken()
  const [tab, setTab] = useState<Tab>('existing')
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<MockCustomer[]>([])
  const [searchInFlight, setSearchInFlight] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Nullable<string>>(null)

  useEffect(() => {
    if (!props.open) {
      setSearchTerm('')
      setResults([])
      setNewName('')
      setSubmitting(false)
      setError(null)
      setTab('existing')
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

  async function handleLinkExisting(customerId: number) {
    setSubmitting(true)
    setError(null)
    try {
      await linkExistingCustomer({
        phoneDigits: props.phoneDigits,
        customerId,
        csrfToken,
      })
      props.onLinked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createCustomerForPhone({
        phoneDigits: props.phoneDigits,
        name: newName.trim(),
        csrfToken,
      })
      props.onLinked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>
            Link {formatPhoneForDisplay(props.phoneDigits)} to a customer
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className='mt-2'>
          <TabsList className='w-full'>
            <TabsTrigger value='existing' className='flex-1'>
              <Search size={12} className='mr-1.5' />
              Link existing
            </TabsTrigger>
            <TabsTrigger value='new' className='flex-1'>
              <UserPlus size={12} className='mr-1.5' />
              Create new
            </TabsTrigger>
          </TabsList>

          <TabsContent value='existing' className='mt-3'>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder='Search by name or phone…'
              clearable
              autoFocus
              aria-label='Search customers'
            />
            <ul className='mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100'>
              {results.map(c => (
                <li
                  key={c.id}
                  className='flex justify-between items-center px-2 py-2 hover:bg-slate-50 rounded'
                >
                  <div className='min-w-0'>
                    <div className='text-sm text-slate-900 truncate'>{c.name}</div>
                    <div className='text-xs text-slate-400'>
                      {formatPhoneForDisplay(c.phone)}
                    </div>
                  </div>
                  <LoadingButton
                    type='button'
                    onClick={() => handleLinkExisting(c.id)}
                    loading={submitting}
                  >
                    Link
                  </LoadingButton>
                </li>
              ))}
              {searchTerm && results.length === 0 && !searchInFlight && (
                <li className='text-xs text-slate-400 px-2 py-3 italic'>
                  No matches — try a different term, or use Create new.
                </li>
              )}
              {searchInFlight && (
                <li className='text-xs text-slate-400 px-2 py-3 italic'>Searching…</li>
              )}
              {!searchTerm && (
                <li className='text-xs text-slate-400 px-2 py-3 italic'>
                  Type a name or phone to search.
                </li>
              )}
            </ul>
          </TabsContent>

          <TabsContent value='new' className='mt-3'>
            <div className='flex flex-col gap-2'>
              <label htmlFor={newNameId} className='text-xs text-slate-600'>
                Customer name
              </label>
              <Input
                id={newNameId}
                placeholder='Full name'
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              <label
                htmlFor={`${newNameId}-phone`}
                className='text-xs text-slate-600 mt-2'
              >
                Phone
              </label>
              <Input
                id={`${newNameId}-phone`}
                value={formatPhoneForDisplay(props.phoneDigits)}
                disabled
              />
              <LoadingButton
                type='button'
                onClick={handleCreate}
                loading={submitting}
                disabled={!newName.trim()}
                className='mt-3'
              >
                Create customer
              </LoadingButton>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className='mt-3 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded'>
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
