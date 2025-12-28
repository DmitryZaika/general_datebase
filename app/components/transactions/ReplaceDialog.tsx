import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogHeader as UiDialogHeader,
  DialogTitle as UiDialogTitle,
} from '~/components/ui/dialog'
import type { SaleSlab } from '~/types/sales'

interface ReplaceOption {
  id: number
  bundle: string
  is_leftover: boolean
  parent_id: number | null
  child_count: number
}

interface ReplaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: SaleSlab | null
  options: ReplaceOption[]
  loading: boolean
  onChoose: (id: number) => void
}

export function ReplaceDialog({
  open,
  onOpenChange,
  target,
  options,
  loading,
  onChoose,
}: ReplaceDialogProps) {
  return (
    <UiDialog open={open} onOpenChange={onOpenChange}>
      <UiDialogContent className='max-w-xl'>
        <UiDialogHeader>
          <UiDialogTitle>Replace Slab</UiDialogTitle>
        </UiDialogHeader>
        <div className='space-y-3'>
          <div className='text-sm text-muted-foreground'>
            Current slab {target?.bundle}
          </div>
          <div className='max-h-80 overflow-y-auto border rounded'>
            {loading ? (
              <div className='p-4 text-sm'>Loading...</div>
            ) : options.length === 0 ? (
              <div className='p-4 text-sm'>No available slabs</div>
            ) : (
              options.map(opt =>
                (() => {
                  const statuses: string[] = []
                  const isPartial = opt.parent_id !== null || opt.child_count > 0
                  statuses.push(isPartial ? 'Partial' : 'Full')
                  if (opt.is_leftover) statuses.push('Leftover')
                  return (
                    <div
                      key={opt.id}
                      className={`p-3 border-b last:border-b-0 cursor-pointer ${
                        opt.id === target?.id ? 'bg-gray-200' : 'hover:bg-blue-50'
                      }`}
                      onClick={() => onChoose(opt.id)}
                    >
                      <div className='font-medium'>Bundle {opt.bundle}</div>
                      <div className='text-xs text-muted-foreground'>
                        {statuses.join(' • ')}
                      </div>
                    </div>
                  )
                })(),
              )
            )}
          </div>
        </div>
      </UiDialogContent>
    </UiDialog>
  )
}
