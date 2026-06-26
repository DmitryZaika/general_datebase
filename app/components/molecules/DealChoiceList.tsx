import type { CustomerDealOption } from '~/utils/customerDeals.server'

function dealOptionName(deal: CustomerDealOption): string {
  const title = deal.title?.trim()
  return title ? title : `Deal #${deal.id}`
}

export { dealOptionName }

function dealAmount(value: number | null): string | null {
  if (value === null) return null
  return `$${Number(value).toLocaleString()}`
}

function shortDealText(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 80)}...`
}

export function readPayloadError(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined
  if (!Object.hasOwn(payload, 'error')) return undefined
  const err = Reflect.get(payload, 'error')
  return typeof err === 'string' ? err : undefined
}

function isCustomerDealOption(item: unknown): item is CustomerDealOption {
  if (item === null || typeof item !== 'object') return false
  const id = Reflect.get(item, 'id')
  if (typeof id !== 'number') return false
  const notes = Reflect.get(item, 'notes')
  if (!Array.isArray(notes)) return false
  const activities = Reflect.get(item, 'activities')
  if (!Array.isArray(activities)) return false
  return true
}

export function parseDealOptionsFromPayload(payload: unknown): CustomerDealOption[] {
  if (payload === null || typeof payload !== 'object') return []
  if (!Object.hasOwn(payload, 'deals')) return []
  const raw = Reflect.get(payload, 'deals')
  if (!Array.isArray(raw)) return []
  return raw.filter(isCustomerDealOption)
}

export function DealChoiceList({
  deals,
  onSelectDeal,
  disabled,
}: {
  deals: CustomerDealOption[]
  onSelectDeal: (dealId: number) => void
  disabled?: boolean
}) {
  return (
    <div className='max-h-[60vh] space-y-2 overflow-y-auto pr-1'>
      {deals.map(deal => (
        <button
          key={deal.id}
          type='button'
          className='w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
          disabled={disabled}
          onClick={() => onSelectDeal(deal.id)}
        >
          <div className='flex items-center justify-between gap-2'>
            <span className='text-sm font-medium text-slate-900'>
              {dealOptionName(deal)}
            </span>
            <span className='text-xs text-slate-500'>#{deal.id}</span>
          </div>
          <div className='mt-1 text-xs text-slate-500'>
            {[deal.list_name, deal.status, dealAmount(deal.amount)]
              .filter(Boolean)
              .join(' - ') || 'No stage'}
          </div>
          {deal.notes.length > 0 ? (
            <div className='mt-2 rounded-md bg-amber-50 px-2 py-1.5'>
              <div className='text-[11px] font-semibold text-amber-900'>Notes</div>
              <div className='mt-1 space-y-1'>
                {deal.notes.map(note => (
                  <div key={note.id} className='text-xs leading-snug text-amber-950'>
                    {shortDealText(note.content)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {deal.activities.length > 0 ? (
            <div className='mt-2 rounded-md bg-blue-50 px-2 py-1.5'>
              <div className='text-[11px] font-semibold text-blue-900'>Activities</div>
              <div className='mt-1 space-y-1'>
                {deal.activities.map(activity => (
                  <div
                    key={activity.id}
                    className='flex items-center justify-between gap-2 text-xs leading-snug text-blue-950'
                  >
                    <span>{shortDealText(activity.name)}</span>
                    <span className='shrink-0 text-[11px] capitalize text-blue-700'>
                      {activity.is_completed ? 'Done' : activity.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </button>
      ))}
    </div>
  )
}
