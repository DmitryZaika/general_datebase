import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CirclePlus,
  Clock,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button, buttonVariants } from '~/components/ui/button'
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

type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'normal'

const getDeadlineUrgency = (deadline: string): DeadlineUrgency => {
  if (isOverdue(deadline)) return 'overdue'
  const diffDays = calendarDayDiff(new Date(deadline))
  if (diffDays === 0) return 'today'
  if (diffDays <= 2) return 'soon'
  return 'normal'
}

const URGENCY_LABEL_STYLE: Readonly<Record<DeadlineUrgency, string>> = {
  overdue: 'text-red-600 bg-red-50 border-red-200',
  today: 'text-orange-600 bg-orange-50 border-orange-200',
  soon: 'text-amber-600',
  normal: 'text-gray-500',
}

const URGENCY_BORDER_STYLE: Readonly<Record<DeadlineUrgency, string>> = {
  overdue: 'border-l-2 border-l-red-400',
  today: 'border-l-2 border-l-orange-400',
  soon: 'border-l-2 border-l-amber-300',
  normal: '',
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
  | { type: 'SET_EDIT'; payload: DealActivity }
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
    case 'SET_EDIT':
      return {
        name: action.payload.name,
        deadline: action.payload.deadline ? new Date(action.payload.deadline) : undefined,
        priority: action.payload.priority,
      }
    case 'RESET':
      return INITIAL_FORM_STATE
  }
}

// --- Hooks ---

function useActivityForm(dealId: number, editingActivityId: number | null) {
  const fetcher = useFetcher()
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE)

  const isSubmitting = fetcher.state !== 'idle'
  const isValid = form.name.trim().length > 0
  const isEditing = editingActivityId !== null

  const submit = useCallback(() => {
    if (!isValid) return

    const payload: Record<string, string> = {
      intent: isEditing ? 'update' : 'create',
      name: form.name.trim(),
      deadline: toDeadlinePayload(form.deadline ?? null),
      priority: form.priority,
    }

    if (isEditing) {
      payload.activityId = String(editingActivityId)
    }

    fetcher.submit(payload, { method: 'POST', action: buildApiAction(dealId) })

    dispatch({ type: 'RESET' })
  }, [fetcher, form, dealId, isValid, isEditing, editingActivityId])

  return { form, dispatch, isSubmitting, isValid, isEditing, submit }
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
    (activityId: number, activityName: string) => {
      deleteFetcher.submit(
        { intent: 'delete', activityId: String(activityId) },
        { method: 'POST', action: buildApiAction(dealId) },
      )
      toast({
        title: 'Activity deleted',
        description: `"${activityName}" has been removed`,
        variant: 'success',
      })
    },
    [deleteFetcher, dealId, toast],
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
  const urgency = getDeadlineUrgency(deadline)
  const hasPill = urgency === 'overdue' || urgency === 'today'
  const Icon = urgency === 'overdue' ? AlertCircle : Clock

  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-[10px]',
        URGENCY_LABEL_STYLE[urgency],
        hasPill && 'rounded-full px-1.5 py-0.5 border',
      )}
    >
      <Icon className='h-2.5 w-2.5' />
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
  onEdit,
  isBeingEdited,
}: {
  activity: DealActivity
  dealId: number
  onEdit: (activity: DealActivity) => void
  isBeingEdited: boolean
}) {
  const { toggle, remove, isToggling, isDeleting, togglingData } =
    useActivityAction(dealId)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isDone = !!activity.is_completed
  const optimisticDone = togglingData?.get('intent') === 'toggle' ? !isDone : isDone
  const urgency = !optimisticDone && activity.deadline
    ? getDeadlineUrgency(activity.deadline)
    : 'normal'

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 transition-all hover:bg-gray-50',
        optimisticDone && 'opacity-60',
        isDeleting && 'opacity-0 scale-95 pointer-events-none',
        isBeingEdited && 'bg-blue-50 ring-1 ring-blue-200',
        URGENCY_BORDER_STYLE[urgency],
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
            optimisticDone && 'text-gray-400 line-through',
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

      <div className='flex items-center gap-0.5 shrink-0'>
        {!optimisticDone && (
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6 shrink-0 text-gray-600 hover:text-blue-500'
            onClick={() => onEdit(activity)}
          >
            <Pencil className='h-3 w-3' />
          </Button>
        )}

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6 shrink-0 text-gray-600 hover:text-red-500'
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Activity</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{activity.name}&quot;?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={() => remove(activity.id, activity.name)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
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

function ActivityForm({
  dealId,
  editingActivity,
  onCancelEdit,
}: {
  dealId: number
  editingActivity: DealActivity | null
  onCancelEdit: () => void
}) {
  const { form, dispatch, isSubmitting, isValid, isEditing, submit } = useActivityForm(
    dealId,
    editingActivity?.id ?? null,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (editingActivity) {
      dispatch({ type: 'SET_EDIT', payload: editingActivity })
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editingActivity])

  const handleCancel = () => {
    dispatch({ type: 'RESET' })
    onCancelEdit()
  }

  const handleSubmit = () => {
    submit()
    if (isEditing) {
      toast({
        title: 'Activity updated',
        description: `Changes saved`,
        variant: 'success',
      })
      onCancelEdit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape' && isEditing) {
      handleCancel()
    }
  }

  return (
    <div className='space-y-2 mb-4'>
      {isEditing && (
        <div className='flex items-center justify-between rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700'>
          <span>Editing: {editingActivity?.name}</span>
          <button type='button' onClick={handleCancel} className='hover:text-blue-900'>
            <X className='h-3.5 w-3.5' />
          </button>
        </div>
      )}
      <Input
        ref={inputRef}
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
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        size='sm'
        className='w-full h-9 text-sm'
      >
        {isEditing ? (
          isSubmitting ? 'Saving...' : 'Save Changes'
        ) : (
          <>
            <CirclePlus className='mr-1.5 h-3.5 w-3.5' />
            {isSubmitting ? 'Adding...' : 'Add Activity'}
          </>
        )}
      </Button>
    </div>
  )
}

function ActivityList({
  dealId,
  activities,
  onEdit,
  editingActivityId,
}: {
  dealId: number
  activities: DealActivity[]
  onEdit: (activity: DealActivity) => void
  editingActivityId: number | null
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
                  <ActivityItem activity={activity} dealId={dealId} onEdit={onEdit} isBeingEdited={editingActivityId === activity.id} />
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
                    <ActivityItem activity={activity} dealId={dealId} onEdit={onEdit} isBeingEdited={editingActivityId === activity.id} />
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
  const [editingActivity, setEditingActivity] = useState<DealActivity | null>(null)

  return (
    <div className='flex flex-col h-full'>
      <h3 className='text-base font-semibold mb-3'>Activity</h3>
      <ActivityForm
        dealId={dealId}
        editingActivity={editingActivity}
        onCancelEdit={() => setEditingActivity(null)}
      />
      <div className='flex-1 overflow-y-auto min-h-0'>
        <ActivityList dealId={dealId} activities={activities} onEdit={setEditingActivity} editingActivityId={editingActivity?.id ?? null} />
      </div>
    </div>
  )
}
