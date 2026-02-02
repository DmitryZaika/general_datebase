import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Clock,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useReducer } from 'react'
import { useFetcher } from 'react-router'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useToast } from '~/hooks/use-toast'
import { cn } from '~/lib/utils'
import {
  ActivityPriority,
  type DealActivity,
} from '~/routes/api.deal-activities.$dealId'
import type { Nullable } from '~/types/utils'

// --- Configuration ---

const PRIORITY_WEIGHT: Readonly<Record<ActivityPriority, number>> = {
  [ActivityPriority.High]: 0,
  [ActivityPriority.Medium]: 1,
  [ActivityPriority.Low]: 2,
}

const PRIORITY_STYLE: Readonly<Record<ActivityPriority, string>> = {
  [ActivityPriority.High]: 'bg-red-100 text-red-700 border-red-200',
  [ActivityPriority.Medium]: 'bg-amber-100 text-amber-700 border-amber-200',
  [ActivityPriority.Low]: 'bg-gray-100 text-gray-600 border-gray-200',
}

const PRIORITY_LABEL: Readonly<Record<ActivityPriority, string>> = {
  [ActivityPriority.High]: 'High',
  [ActivityPriority.Medium]: 'Medium',
  [ActivityPriority.Low]: 'Low',
}

const PRIORITY_DOT_COLOR: Readonly<Record<ActivityPriority, string>> = {
  [ActivityPriority.High]: 'bg-red-500',
  [ActivityPriority.Medium]: 'bg-amber-500',
  [ActivityPriority.Low]: 'bg-gray-400',
}

const ITEM_VARIANTS = {
  initial: { opacity: 0, height: 0, scale: 0.95 },
  animate: { opacity: 1, height: 'auto', scale: 1 },
  exit: { opacity: 0, height: 0, scale: 0.95 },
}

const ITEM_TRANSITION = { duration: 0.25, ease: 'easeInOut' as const }

const INITIAL_FORM_STATE: FormState = {
  name: '',
  deadline: undefined,
  priority: ActivityPriority.Medium,
}

// --- Pure Functions ---

const comparePriority = (a: DealActivity, b: DealActivity): number =>
  PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]

const compareDeadlineAsc = (a: DealActivity, b: DealActivity): number => {
  if (a.deadline && b.deadline) {
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  }
  return a.deadline ? -1 : b.deadline ? 1 : 0
}

const compareCompletedDesc = (a: DealActivity, b: DealActivity): number => {
  if (a.completed_at && b.completed_at) {
    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  }
  return a.completed_at ? -1 : b.completed_at ? 1 : 0
}

const composeSorters =
  <T,>(...comparators: Array<(a: T, b: T) => number>) =>
  (a: T, b: T): number =>
    comparators.reduce((result, comparator) => (result !== 0 ? result : comparator(a, b)), 0)

const partitionActivities = (
  activities: DealActivity[] = [],
): { todo: DealActivity[]; done: DealActivity[] } => {
  const source = activities ?? []

  const todo = source
    .filter(a => !a.is_completed)
    .sort(composeSorters(comparePriority, compareDeadlineAsc))

  const done = source
    .filter(a => !!a.is_completed)
    .sort(compareCompletedDesc)

  return { todo, done }
}

const isOverdue = (deadline: string): boolean => {
  const date = new Date(deadline)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (hasTime) return date.getTime() < Date.now()
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay.getTime() < Date.now()
}

const DAY_MS = 86_400_000

const calendarDayDiff = (target: Date): number => {
  const deadlineDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const today = new Date()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((deadlineDay.getTime() - todayDay.getTime()) / DAY_MS)
}

const formatDeadline = (deadline: string): string => {
  const date = new Date(deadline)
  const diffDays = calendarDayDiff(date)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const timeSuffix = hasTime ? ` ${format(date, 'HH:mm')}` : ''

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return `Today${timeSuffix}`
  if (diffDays === 1) return `Tomorrow${timeSuffix}`
  return format(date, 'MMM d') + timeSuffix
}

const formatFormDeadline = (d: Date): string => {
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  return hasTime ? format(d, 'MMM d, yyyy HH:mm') : format(d, 'MMM d, yyyy')
}

const buildApiAction = (dealId: number): string =>
  `/api/deal-activities/${dealId}`

const toDeadlinePayload = (deadline: Nullable<Date>): string =>
  deadline ? format(deadline, "yyyy-MM-dd'T'HH:mm:ss") : ''

// --- Form Reducer ---

interface FormState {
  name: string
  deadline: Date | undefined
  priority: ActivityPriority
}

type FormAction =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_DEADLINE_DATE'; payload: Date | undefined }
  | { type: 'SET_DEADLINE_TIME'; payload: { hours: number; minutes: number } }
  | { type: 'SET_PRIORITY'; payload: ActivityPriority }
  | { type: 'RESET' }

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.payload }
    case 'SET_DEADLINE_DATE': {
      if (!action.payload) return { ...state, deadline: undefined }
      const next = new Date(action.payload)
      if (state.deadline) {
        next.setHours(state.deadline.getHours(), state.deadline.getMinutes())
      }
      return { ...state, deadline: next }
    }
    case 'SET_DEADLINE_TIME': {
      if (!state.deadline) return state
      const updated = new Date(state.deadline)
      updated.setHours(action.payload.hours, action.payload.minutes)
      return { ...state, deadline: updated }
    }
    case 'SET_PRIORITY':
      return { ...state, priority: action.payload }
    case 'RESET':
      return INITIAL_FORM_STATE
  }
}

// --- Hooks ---

function useActivityForm(dealId: number) {
  const fetcher = useFetcher()
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE)

  const isSubmitting = fetcher.state !== 'idle'
  const isValid = form.name.trim().length > 0

  const submit = useCallback(() => {
    if (!isValid) return

    fetcher.submit(
      {
        intent: 'create',
        name: form.name.trim(),
        deadline: toDeadlinePayload(form.deadline ?? null),
        priority: form.priority,
      },
      { method: 'POST', action: buildApiAction(dealId) },
    )

    dispatch({ type: 'RESET' })
  }, [fetcher, form, dealId, isValid])

  return { form, dispatch, isSubmitting, isValid, submit }
}

function useActivityAction(dealId: number) {
  const toggleFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const { toast } = useToast()

  const toggle = useCallback(
    (activityId: number, activityName: string, isCurrentlyDone: boolean) => {
      toggleFetcher.submit(
        { intent: 'toggle', activityId: String(activityId) },
        { method: 'POST', action: buildApiAction(dealId) },
      )
      if (!isCurrentlyDone) {
        toast({
          title: 'Activity completed',
          description: `"${activityName}" marked as done`,
          variant: 'success',
        })
      }
    },
    [toggleFetcher, dealId, toast],
  )

  const remove = useCallback(
    (activityId: number) => {
      deleteFetcher.submit(
        { intent: 'delete', activityId: String(activityId) },
        { method: 'POST', action: buildApiAction(dealId) },
      )
    },
    [deleteFetcher, dealId],
  )

  return {
    toggle,
    remove,
    isToggling: toggleFetcher.state !== 'idle',
    isDeleting: deleteFetcher.state !== 'idle',
    togglingData: toggleFetcher.formData,
  }
}

// --- Sub-Components ---

function PriorityDot({ priority }: { priority: ActivityPriority }) {
  return <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT_COLOR[priority])} />
}

function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return (
    <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', PRIORITY_STYLE[priority])}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}

function DeadlineLabel({ deadline }: { deadline: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[10px]',
        isOverdue(deadline) ? 'text-red-500' : 'text-gray-500',
      )}
    >
      <Clock className='h-2.5 w-2.5' />
      {formatDeadline(deadline)}
    </span>
  )
}

function CompletedLabel({ completedAt }: { completedAt: string }) {
  return (
    <span className='text-[10px] text-gray-600'>
      Done {format(new Date(completedAt), 'MMM d')}
    </span>
  )
}

function SectionEmptyState({ label }: { label: string }) {
  return (
    <p className='text-xs text-gray-400 py-3 text-center italic'>{label}</p>
  )
}

function SectionHeader({
  label,
  count,
  collapsible = false,
  isOpen,
  onToggle,
}: {
  label: string
  count: number
  collapsible?: boolean
  isOpen?: boolean
  onToggle?: () => void
}) {
  const content = (
    <>
      {label} ({count})
      {collapsible &&
        (isOpen ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />)}
    </>
  )

  if (collapsible) {
    return (
      <button
        type='button'
        onClick={onToggle}
        className='flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700'
      >
        {content}
      </button>
    )
  }

  return (
    <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>
      {content}
    </p>
  )
}

function ActivityItem({
  activity,
  dealId,
}: {
  activity: DealActivity
  dealId: number
}) {
  const { toggle, remove, isToggling, isDeleting, togglingData } =
    useActivityAction(dealId)

  const isDone = !!activity.is_completed
  const optimisticDone = togglingData?.get('intent') === 'toggle' ? !isDone : isDone

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 transition-all hover:bg-gray-50',
        optimisticDone && 'opacity-60',
        isDeleting && 'opacity-0 scale-95 pointer-events-none',
      )}
    >
      <Checkbox
        checked={optimisticDone}
        onCheckedChange={() => toggle(activity.id, activity.name, isDone)}
        disabled={isToggling}
        className='mt-0.5 h-4 w-4 shrink-0'
      />

      <div className='flex-1 min-w-0'>
        <span
          className={cn(
            'text-sm leading-tight block',
            optimisticDone && 'text-gray-600',
          )}
        >
          {activity.name}
        </span>

        <div className='flex items-center gap-1.5 mt-0.5 flex-wrap'>
          <PriorityBadge priority={activity.priority} />
          {activity.deadline && !optimisticDone && (
            <DeadlineLabel deadline={activity.deadline} />
          )}
          {optimisticDone && activity.completed_at && (
            <CompletedLabel completedAt={activity.completed_at} />
          )}
        </div>
      </div>

      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-500'
        onClick={() => remove(activity.id)}
      >
        <Trash2 className='h-3 w-3' />
      </Button>
    </div>
  )
}

function DeadlineControls({
  deadline,
  onTimeChange,
  onClear,
}: {
  deadline: Date | undefined
  onTimeChange: (hours: number, minutes: number) => void
  onClear: () => void
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return
    const [h, m] = e.target.value.split(':').map(Number)
    onTimeChange(h, m)
  }

  return (
    <div className='flex items-center gap-2 px-3 pb-3 border-t pt-2'>
      <Clock className='h-3.5 w-3.5 text-gray-600 shrink-0' />
      <input
        type='time'
        value={deadline ? format(deadline, 'HH:mm') : ''}
        onChange={handleChange}
        disabled={!deadline}
        className='h-7 text-sm border rounded-md px-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed'
      />
      {deadline && (
        <Button
          variant='ghost'
          size='icon'
          type='button'
          className='h-7 w-7 shrink-0 text-gray-600 hover:text-red-500'
          onClick={onClear}
        >
          <X className='h-3.5 w-3.5' />
        </Button>
      )}
    </div>
  )
}

function ActivityForm({ dealId }: { dealId: number }) {
  const { form, dispatch, isSubmitting, isValid, submit } = useActivityForm(dealId)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className='space-y-2 mb-4'>
      <Input
        placeholder='Activity name'
        value={form.name}
        onChange={e => dispatch({ type: 'SET_NAME', payload: e.target.value })}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        className='h-9 text-sm'
      />

      <div className='flex gap-2'>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              type='button'
              className={cn(
                'flex-1 h-9 justify-start text-left text-sm font-normal',
                !form.deadline && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className='mr-1.5 h-3.5 w-3.5 shrink-0' />
              <span className='truncate'>
                {form.deadline ? formatFormDeadline(form.deadline) : 'Deadline'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              mode='single'
              selected={form.deadline}
              onSelect={d => dispatch({ type: 'SET_DEADLINE_DATE', payload: d })}
            />
            <DeadlineControls
              deadline={form.deadline}
              onTimeChange={(hours, minutes) =>
                dispatch({ type: 'SET_DEADLINE_TIME', payload: { hours, minutes } })
              }
              onClear={() => dispatch({ type: 'SET_DEADLINE_DATE', payload: undefined })}
            />
          </PopoverContent>
        </Popover>

        <Select
          value={form.priority}
          onValueChange={v =>
            dispatch({ type: 'SET_PRIORITY', payload: v as ActivityPriority })
          }
        >
          <SelectTrigger className='w-[110px] h-9 text-sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ActivityPriority).map(p => (
              <SelectItem key={p} value={p}>
                <span className='flex items-center gap-1.5'>
                  <PriorityDot priority={p} />
                  {PRIORITY_LABEL[p]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={submit}
        disabled={!isValid || isSubmitting}
        size='sm'
        className='w-full h-9 text-sm'
      >
        <CirclePlus className='mr-1.5 h-3.5 w-3.5' />
        {isSubmitting ? 'Adding...' : 'Add Activity'}
      </Button>
    </div>
  )
}

function ActivityList({
  dealId,
  activities,
}: {
  dealId: number
  activities: DealActivity[]
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useReducer((s: boolean) => !s, true)

  const { todo, done } = useMemo(() => partitionActivities(activities), [activities])

  return (
    <div className='space-y-4'>
      <div>
        <SectionHeader label='To Do' count={todo.length} />
        {todo.length > 0 ? (
          <div className='space-y-1'>
            <AnimatePresence initial={false}>
              {todo.map(activity => (
                <motion.div
                  key={activity.id}
                  layout
                  variants={ITEM_VARIANTS}
                  initial='initial'
                  animate='animate'
                  exit='exit'
                  transition={ITEM_TRANSITION}
                  style={{ overflow: 'hidden' }}
                >
                  <ActivityItem activity={activity} dealId={dealId} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <SectionEmptyState label='No tasks yet' />
        )}
      </div>

      <div>
        <SectionHeader
          label='History'
          count={done.length}
          collapsible
          isOpen={isHistoryOpen}
          onToggle={setIsHistoryOpen}
        />
        {isHistoryOpen && (
          done.length > 0 ? (
            <div className='space-y-1'>
              <AnimatePresence initial={false}>
                {done.map(activity => (
                  <motion.div
                    key={activity.id}
                    layout
                    variants={ITEM_VARIANTS}
                    initial='initial'
                    animate='animate'
                    exit='exit'
                    transition={ITEM_TRANSITION}
                  >
                    <ActivityItem activity={activity} dealId={dealId} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <SectionEmptyState label='No completed tasks' />
          )
        )}
      </div>
    </div>
  )
}

// --- Main Component ---

interface DealActivityPanelProps {
  dealId: number
  activities?: DealActivity[]
}

export function DealActivityPanel({ dealId, activities = [] }: DealActivityPanelProps) {
  return (
    <div className='flex flex-col h-full'>
      <h3 className='text-base font-semibold mb-3'>Activity</h3>
      <ActivityForm dealId={dealId} />
      <div className='flex-1 overflow-y-auto min-h-0'>
        <ActivityList dealId={dealId} activities={activities} />
      </div>
    </div>
  )
}
