import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Clock,
  Eye,
  EyeClosed,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useFetcher, useLocation, useNavigate, useParams } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import ClipboardIcon from '~/components/icons/ClipboardIcon'
import NoteIcon from '~/components/icons/NoteIcon'
import { CallItemContent } from '~/components/molecules/CallItemContent'
import { SmsThreadCard } from '~/components/molecules/SmsThreadCard'
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
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'
import { useToast } from '~/hooks/use-toast'
import { useNoteAction } from '~/hooks/useNoteAction'
import { buildActivityApiAction } from '~/lib/dealApiHelpers'
import { cn, parseLocalDate } from '~/lib/utils'
import {
  ActivityPriority,
  type DealActivity,
} from '~/routes/api.deal-activities.$dealId'
import type { DealNote } from '~/routes/api.deal-notes.$dealId'
import type {
  DeadlineUrgency,
  DealActivityPanelProps,
  DealEmailHistoryItem,
  HistoryItem,
  HistoryTab,
} from '~/types/dealActivityTypes'
import type { Nullable } from '~/types/utils'
import { type CallEntry, mapToCallEntry } from '~/utils/callDisplayHelpers'
import type { Calls200Response } from '~/utils/cloudtalk.server'
import {
  groupSmsIntoThreads,
  mapRowToSmsEntry,
  type SmsRow,
  type SmsThread,
} from '~/utils/smsDisplayHelpers'
import { stripHtmlTags } from '~/utils/stringHelpers'
import { NoteForm } from './NoteForm'
import { NoteItem } from './NoteItem'

// --- Configuration ---

const ACTION_CARD_CLASS = 'rounded-md px-3 py-2.5 bg-gray-50 border border-gray-200'

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

// --- Pure Functions ---

const comparePriority = (a: DealActivity, b: DealActivity): number =>
  PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]

const compareDeadlineAsc = (a: DealActivity, b: DealActivity): number => {
  if (a.deadline && b.deadline) {
    return parseLocalDate(a.deadline).getTime() - parseLocalDate(b.deadline).getTime()
  }
  return a.deadline ? -1 : b.deadline ? 1 : 0
}

const compareCompletedDesc = (a: DealActivity, b: DealActivity): number => {
  if (a.completed_at && b.completed_at) {
    return (
      parseLocalDate(b.completed_at).getTime() -
      parseLocalDate(a.completed_at).getTime()
    )
  }
  return a.completed_at ? -1 : b.completed_at ? 1 : 0
}

const composeSorters =
  <T,>(...comparators: Array<(a: T, b: T) => number>) =>
  (a: T, b: T): number =>
    comparators.reduce(
      (result, comparator) => (result !== 0 ? result : comparator(a, b)),
      0,
    )

const partitionActivities = (
  activities: DealActivity[] = [],
): { todo: DealActivity[]; done: DealActivity[] } => {
  const todo = activities
    .filter(a => !a.is_completed)
    .sort(composeSorters(comparePriority, compareDeadlineAsc))

  const done = activities.filter(a => !!a.is_completed).sort(compareCompletedDesc)

  return { todo, done }
}

const DAY_MS = 86_400_000

const calendarDayDiff = (target: Date): number => {
  const deadlineDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  )
  const today = new Date()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((deadlineDay.getTime() - todayDay.getTime()) / DAY_MS)
}

const isOverdue = (deadline: string): boolean => {
  const date = parseLocalDate(deadline)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (hasTime) return date.getTime() < Date.now()
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay.getTime() < Date.now()
}

const getDeadlineUrgency = (deadline: string): DeadlineUrgency => {
  if (isOverdue(deadline)) return 'overdue'
  const diffDays = calendarDayDiff(parseLocalDate(deadline))
  if (diffDays === 0) return 'today'
  if (diffDays <= 2) return 'soon'
  return 'normal'
}

const formatDeadline = (deadline: string): string => {
  const date = parseLocalDate(deadline)
  const diffDays = calendarDayDiff(date)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  const timeSuffix = hasTime ? ` ${format(date, 'h:mm a')}` : ''

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return `Today${timeSuffix}`
  if (diffDays === 1) return `Tomorrow${timeSuffix}`
  return format(date, 'MMM d') + timeSuffix
}

const formatFormDeadline = (d: Date): string => {
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  return hasTime ? format(d, 'MMM d, yyyy h:mm a') : format(d, 'MMM d, yyyy')
}

const toDeadlinePayload = (deadline: Nullable<Date>): string => {
  if (!deadline) return ''
  const hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0
  return hasTime
    ? format(deadline, "yyyy-MM-dd'T'HH:mm:ss")
    : format(deadline, 'yyyy-MM-dd')
}

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

const INITIAL_FORM_STATE: FormState = {
  name: '',
  deadline: undefined,
  priority: ActivityPriority.Medium,
}

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
    case 'SET_EDIT': {
      const d = action.payload.deadline
        ? parseLocalDate(action.payload.deadline)
        : undefined
      if (d) {
        const snapped = Math.round(d.getMinutes() / 5) * 5
        if (snapped >= 60) {
          d.setHours(d.getHours() + 1, 0, 0, 0)
        } else {
          d.setMinutes(snapped, 0, 0)
        }
      }
      return {
        name: action.payload.name,
        deadline: d,
        priority: action.payload.priority,
      }
    }
    case 'RESET':
      return INITIAL_FORM_STATE
  }
}

// --- Hooks ---

function useActivityForm(dealId: number, editingActivityId: number | null) {
  const fetcher = useFetcher()
  const token = useAuthenticityToken()
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE)

  const isSubmitting = fetcher.state !== 'idle'
  const isValid = form.name.trim().length > 0
  const isEditing = editingActivityId !== null

  const submit = useCallback(() => {
    if (!isValid) return

    const deadlineLocal = toDeadlinePayload(form.deadline ?? null)
    const hasTime = form.deadline
      ? form.deadline.getHours() !== 0 || form.deadline.getMinutes() !== 0
      : false
    const payload: Record<string, string> = {
      intent: isEditing ? 'update' : 'create',
      name: form.name.trim(),
      deadline: deadlineLocal,
      deadlineUtc: hasTime && form.deadline ? form.deadline.toISOString() : '',
      priority: form.priority,
      csrf: token,
    }

    if (isEditing) {
      payload.activityId = String(editingActivityId)
    }

    fetcher.submit(payload, {
      method: 'POST',
      action: buildActivityApiAction(dealId),
    })

    dispatch({ type: 'RESET' })
  }, [fetcher.submit, form, dealId, isValid, isEditing, editingActivityId, token])

  return { form, dispatch, isSubmitting, isValid, isEditing, submit }
}

function useActivityAction(dealId: number) {
  const toggleFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const token = useAuthenticityToken()
  const { toast } = useToast()

  const toggle = useCallback(
    (activityId: number, activityName: string, isCurrentlyDone: boolean) => {
      toggleFetcher.submit(
        { intent: 'toggle', activityId: String(activityId), csrf: token },
        { method: 'POST', action: buildActivityApiAction(dealId) },
      )
      if (!isCurrentlyDone) {
        toast({
          title: 'Activity completed',
          description: `"${activityName}" marked as done`,
          variant: 'success',
        })
      }
    },
    [toggleFetcher.submit, dealId, toast, token],
  )

  const remove = useCallback(
    (activityId: number, activityName: string) => {
      deleteFetcher.submit(
        { intent: 'delete', activityId: String(activityId), csrf: token },
        { method: 'POST', action: buildActivityApiAction(dealId) },
      )
      toast({
        title: 'Activity deleted',
        description: `"${activityName}" has been removed`,
        variant: 'success',
      })
    },
    [deleteFetcher.submit, dealId, toast, token],
  )

  return {
    toggle,
    remove,
    isToggling: toggleFetcher.state !== 'idle',
    isDeleting: deleteFetcher.state !== 'idle',
    togglingData: toggleFetcher.formData,
  }
}

// --- Shared Sub-Components ---

function PriorityDot({ priority }: { priority: ActivityPriority }) {
  return <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT_COLOR[priority])} />
}

function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return (
    <Badge
      className={cn('text-[10px] px-1.5 py-0 h-4 border', PRIORITY_STYLE[priority])}
    >
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
      Done {format(parseLocalDate(completedAt), 'MMM d')}
    </span>
  )
}

function SectionEmptyState({ label }: { label: string }) {
  return <p className='text-xs text-gray-400 py-3 text-center italic'>{label}</p>
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
        (isOpen ? (
          <ChevronUp className='h-3 w-3' />
        ) : (
          <ChevronDown className='h-3 w-3' />
        ))}
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

// --- Timeline Wrapper ---

function TimelineItem({
  icon: Icon,
  isLast = false,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isLast?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='flex gap-2.5'>
      <div className='flex flex-col items-center shrink-0'>
        <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 border border-gray-200'>
          <Icon className='h-4 w-4 text-gray-500' />
        </div>
        {!isLast && (
          <div className='flex-1 w-px border-l border-dashed border-gray-300 my-0.5' />
        )}
      </div>
      <div className='flex-1 min-w-0 pb-3'>{children}</div>
    </div>
  )
}

// --- Activity Components ---

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
  const urgency =
    !optimisticDone && activity.deadline
      ? getDeadlineUrgency(activity.deadline)
      : 'normal'

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 transition-all',
        optimisticDone ? 'bg-gray-50' : 'hover:bg-gray-50',
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
        {optimisticDone ? (
          <span
            className={cn(
              'text-sm leading-tight block whitespace-pre-wrap break-words',
              'text-gray-500',
            )}
          >
            {activity.name}
          </span>
        ) : (
          <button
            type='button'
            onClick={() => onEdit(activity)}
            className={cn(
              'text-sm leading-tight block whitespace-pre-wrap break-words text-left w-full',
              'rounded px-0.5 -mx-0.5 hover:bg-gray-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 cursor-pointer',
            )}
          >
            {activity.name}
          </button>
        )}

        <div className='flex items-center gap-1.5 mt-0.5 flex-wrap'>
          <PriorityBadge priority={activity.priority} />
          {activity.deadline && !optimisticDone && (
            <DeadlineLabel deadline={activity.deadline} />
          )}
          {optimisticDone && activity.completed_at && (
            <CompletedLabel completedAt={activity.completed_at} />
          )}
          {activity.created_by && (
            <span className='text-[10px] text-gray-900 px-1.5 py-0.5'>
              Created By {activity.created_by}
            </span>
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

// --- Deadline & Time Controls ---

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5)

function to12Hour(h24: number): { hour: number; period: 'AM' | 'PM' } {
  const period = h24 >= 12 ? ('PM' as const) : ('AM' as const)
  const hour = h24 % 12 || 12
  return { hour, period }
}

function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function roundTo5(min: number): number {
  return Math.min(Math.round(min / 5) * 5, 55)
}

function DeadlineControls({
  deadline,
  onTimeChange,
  onClearTime,
  onClearDate,
}: {
  deadline: Date | undefined
  onTimeChange: (hours: number, minutes: number) => void
  onClearTime: () => void
  onClearDate: () => void
}) {
  if (!deadline) return null

  const hasTime = deadline.getHours() !== 0 || deadline.getMinutes() !== 0
  const current = to12Hour(deadline.getHours())
  const currentMin = roundTo5(deadline.getMinutes())

  const handleHour = (val: string) => {
    const h24 = to24Hour(Number(val), current.period)
    onTimeChange(h24, currentMin)
  }

  const handleMinute = (val: string) => {
    const h24 = to24Hour(current.hour, current.period)
    onTimeChange(h24, Number(val))
  }

  const handlePeriod = (val: string) => {
    const h24 = to24Hour(current.hour, val as 'AM' | 'PM')
    onTimeChange(h24, currentMin)
  }

  return (
    <div className='px-3 pb-3 border-t pt-2 space-y-2'>
      {hasTime ? (
        <div className='flex items-center gap-1.5'>
          <Clock className='h-3.5 w-3.5 text-gray-600 shrink-0' />
          <Select value={String(current.hour)} onValueChange={handleHour}>
            <SelectTrigger className='w-[58px] h-7 text-sm px-2'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS_12.map(h => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className='text-sm font-medium text-gray-500'>:</span>
          <Select value={String(currentMin)} onValueChange={handleMinute}>
            <SelectTrigger className='w-[58px] h-7 text-sm px-2'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES_5.map(m => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={current.period} onValueChange={handlePeriod}>
            <SelectTrigger className='w-[62px] h-7 text-sm px-2'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='AM'>AM</SelectItem>
              <SelectItem value='PM'>PM</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='icon'
            type='button'
            className='h-7 w-7 shrink-0 text-gray-400 hover:text-red-500'
            onClick={onClearTime}
          >
            <X className='h-3.5 w-3.5' />
          </Button>
        </div>
      ) : (
        <Button
          variant='ghost'
          type='button'
          className='h-7 text-xs text-gray-500 hover:text-gray-700 px-2'
          onClick={() => onTimeChange(9, 0)}
        >
          <Clock className='h-3 w-3 mr-1.5' />
          Add time
        </Button>
      )}
      <Button
        variant='ghost'
        type='button'
        className='h-6 text-xs text-red-400 hover:text-red-600 px-2 w-full'
        onClick={onClearDate}
      >
        <X className='h-3 w-3 mr-1' />
        Clear deadline
      </Button>
    </div>
  )
}

// --- Activity Form ---

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [deadlineOpen, setDeadlineOpen] = useState(false)
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
        description: 'Changes saved',
        variant: 'success',
      })
      onCancelEdit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (isValid && !isSubmitting) handleSubmit()
    }
    if (e.key === 'Escape' && isEditing) {
      handleCancel()
    }
  }

  return (
    <div className='space-y-2 mb-4'>
      {isEditing && (
        <div className='flex items-center justify-between rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 gap-2'>
          <span className='whitespace-pre-wrap break-words line-clamp-2 min-w-0'>
            Editing: {editingActivity?.name}
          </span>
          <button type='button' onClick={handleCancel} className='hover:text-blue-900'>
            <X className='h-3.5 w-3.5' />
          </button>
        </div>
      )}
      <Textarea
        ref={inputRef}
        placeholder='Activity name'
        value={form.name}
        onChange={e => dispatch({ type: 'SET_NAME', payload: e.target.value })}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        rows={1}
        className='resize-none text-sm w-full min-h-9 py-1.5 leading-snug break-words [field-sizing:content]'
      />

      <div className='flex gap-2'>
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
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
              onClearTime={() =>
                dispatch({
                  type: 'SET_DEADLINE_TIME',
                  payload: { hours: 0, minutes: 0 },
                })
              }
              onClearDate={() => {
                dispatch({ type: 'SET_DEADLINE_DATE', payload: undefined })
                setDeadlineOpen(false)
              }}
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
          isSubmitting ? (
            'Saving...'
          ) : (
            'Save Changes'
          )
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

// --- Email history row ---

function makeEmailSnippet(body: string | null | undefined, max = 120): string {
  if (!body) return ''
  const text = stripHtmlTags(body)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function EmailHistoryRow({ email }: { email: DealEmailHistoryItem }) {
  const location = useLocation()
  const params = useParams()
  const isAdmin = location.pathname.includes('/admin/')
  const basePath = isAdmin ? '/admin/deals' : '/employee/deals'
  const dealId = params.dealId ?? ''
  const searchParams = new URLSearchParams(location.search)
  searchParams.set('messageId', String(email.id))
  const to = `${basePath}/edit/${dealId}/history/chat/${email.thread_id}?${searchParams.toString()}`

  const sentAt = new Date(email.sent_at)
  const sentLabel = Number.isNaN(sentAt.getTime())
    ? ''
    : format(sentAt, 'MMM d, h:mm a')

  const isSent = !!email.sender_user_id
  const isRead = isSent ? (email.read_count ?? 0) > 0 : !!email.employee_read_at
  const hasAttachments = !!email.has_attachments
  const snippet = makeEmailSnippet(email.body)

  return (
    <Link
      to={to}
      className='group flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors'
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 border shrink-0',
              isSent
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-green-100 text-green-700 border-green-200',
            )}
          >
            {isSent ? 'Sent' : 'Received'}
          </Badge>
          <span className='text-sm font-medium truncate'>
            {email.subject || '(no subject)'}
          </span>
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
          <span className='w-3 flex items-center justify-center'>
            {hasAttachments ? (
              <Paperclip
                className='h-3 w-3 text-gray-500'
                aria-label='Has attachments'
              />
            ) : null}
          </span>
          <span className='w-3 flex items-center justify-center'>
            {isRead ? (
              <Eye className='h-3 w-3 text-blue-500' aria-label='Read' />
            ) : (
              <EyeClosed className='h-3 w-3 text-gray-400' aria-label='Unread' />
            )}
          </span>
          <span className='text-[10px] text-gray-500 w-22 text-right tabular-nums'>
            {sentLabel}
          </span>
        </div>
      </div>
      {snippet ? (
        <p className='text-xs text-gray-500 line-clamp-1 break-words'>{snippet}</p>
      ) : null}
    </Link>
  )
}

// --- History Sub-tabs ---

function HistoryTabButtons({
  activeTab,
  onTabChange,
  activitiesCount,
  notesCount,
  actionsCount,
  smsThreadsCount,
  emailsCount,
}: {
  activeTab: HistoryTab
  onTabChange: (tab: HistoryTab) => void
  activitiesCount: number
  notesCount: number
  actionsCount: number
  smsThreadsCount: number
  emailsCount: number
}) {
  const tabs: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'activities', label: `Activities (${activitiesCount})` },
    { key: 'notes', label: `Notes (${notesCount})` },
    { key: 'actions', label: `Actions (${actionsCount})` },
    { key: 'sms', label: `SMS (${smsThreadsCount})` },
    { key: 'emails', label: `Emails (${emailsCount})` },
  ]

  return (
    <div className='flex gap-1 mb-2'>
      {tabs.map(tab => (
        <button
          key={tab.key}
          type='button'
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
            activeTab === tab.key
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// --- Activity List ---

function ActivityList({
  dealId,
  activities,
  notes,
  actions,
  smsThreads,
  emails,
  onEdit,
  editingActivityId,
  historyHeaderRef,
}: {
  dealId: number
  activities: DealActivity[]
  notes: DealNote[]
  actions: CallEntry[]
  smsThreads: SmsThread[]
  emails: DealEmailHistoryItem[]
  onEdit: (activity: DealActivity) => void
  editingActivityId: number | null
  historyHeaderRef: React.RefObject<HTMLDivElement | null>
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useReducer((s: boolean) => !s, true)
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all')
  const noteHandlers = useNoteAction(dealId)

  const { todo, done } = useMemo(() => partitionActivities(activities), [activities])

  const sortedEmails = useMemo(
    () =>
      [...emails].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      ),
    [emails],
  )

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        return (
          parseLocalDate(b.created_at).getTime() -
          parseLocalDate(a.created_at).getTime()
        )
      }),
    [notes],
  )

  const allHistoryItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...done.map(
        a =>
          ({
            type: 'activity' as const,
            data: a,
            date: a.completed_at || a.created_at,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...notes.map(
        n =>
          ({
            type: 'note' as const,
            data: n,
            date: n.created_at,
            isPinned: !!n.is_pinned,
          }) satisfies HistoryItem,
      ),
      ...actions.map(
        a =>
          ({
            type: 'action' as const,
            data: a,
            date: a.startedAt,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...smsThreads.map(
        t =>
          ({
            type: 'smsThread' as const,
            data: t,
            date: t.lastMessageAt,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...emails.map(
        e =>
          ({
            type: 'email' as const,
            data: e,
            date: e.sent_at,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
    ]

    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      const aTime =
        a.type === 'email' || a.type === 'action' || a.type === 'smsThread'
          ? new Date(a.date).getTime()
          : parseLocalDate(a.date ?? '').getTime()
      const bTime =
        b.type === 'email' || b.type === 'action' || b.type === 'smsThread'
          ? new Date(b.date).getTime()
          : parseLocalDate(b.date ?? '').getTime()
      return bTime - aTime
    })

    return items
  }, [done, notes, actions, smsThreads, emails])

  const historyCount =
    done.length + notes.length + actions.length + smsThreads.length + emails.length

  const renderHistoryItem = useCallback(
    (item: HistoryItem, isLast: boolean): ReactNode => {
      switch (item.type) {
        case 'activity':
          return (
            <TimelineItem
              key={`activity-${item.data.id}`}
              icon={ClipboardIcon}
              isLast={isLast}
            >
              <ActivityItem
                activity={item.data}
                dealId={dealId}
                onEdit={onEdit}
                isBeingEdited={editingActivityId === item.data.id}
              />
            </TimelineItem>
          )
        case 'note':
          return (
            <TimelineItem key={`note-${item.data.id}`} icon={NoteIcon} isLast={isLast}>
              <NoteItem note={item.data} handlers={noteHandlers} />
            </TimelineItem>
          )
        case 'action':
          return (
            <TimelineItem
              key={`action-${item.data.callId}`}
              icon={Phone}
              isLast={isLast}
            >
              <div className={ACTION_CARD_CLASS}>
                <CallItemContent
                  call={item.data}
                  audioSrc={`/api/cloudtalk/userCallMedia/${item.data.callId}`}
                  compact
                />
              </div>
            </TimelineItem>
          )
        case 'smsThread':
          return (
            <TimelineItem
              key={`sms-${item.data.customerPhone}`}
              icon={MessageSquare}
              isLast={isLast}
            >
              <div className={ACTION_CARD_CLASS}>
                <SmsThreadCard thread={item.data} compact />
              </div>
            </TimelineItem>
          )
        case 'email':
          return (
            <TimelineItem
              key={`email-${item.data.thread_id}-${item.data.id}`}
              icon={Mail}
              isLast={isLast}
            >
              <EmailHistoryRow email={item.data} />
            </TimelineItem>
          )
      }
    },
    [dealId, onEdit, editingActivityId, noteHandlers],
  )

  const tabRenderers = useMemo<Record<HistoryTab, () => ReactNode>>(
    () => ({
      activities: () => {
        if (done.length === 0)
          return <SectionEmptyState label='No completed activities' />
        return (
          <div>
            <AnimatePresence initial={false}>
              {done.map((activity, index) => (
                <motion.div
                  key={`activity-${activity.id}`}
                  layout
                  variants={ITEM_VARIANTS}
                  initial='initial'
                  animate='animate'
                  exit='exit'
                  transition={ITEM_TRANSITION}
                >
                  <TimelineItem icon={ClipboardIcon} isLast={index === done.length - 1}>
                    <ActivityItem
                      activity={activity}
                      dealId={dealId}
                      onEdit={onEdit}
                      isBeingEdited={editingActivityId === activity.id}
                    />
                  </TimelineItem>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      },
      notes: () => {
        if (sortedNotes.length === 0) return <SectionEmptyState label='No notes yet' />
        return (
          <div>
            {sortedNotes.map((note, index) => (
              <TimelineItem
                key={`note-${note.id}`}
                icon={NoteIcon}
                isLast={index === sortedNotes.length - 1}
              >
                <NoteItem note={note} handlers={noteHandlers} />
              </TimelineItem>
            ))}
          </div>
        )
      },
      actions: () => {
        if (actions.length === 0) return <SectionEmptyState label='No actions yet' />
        return (
          <div>
            {actions.map((call, index) => (
              <TimelineItem
                key={`action-${call.callId}`}
                icon={Phone}
                isLast={index === actions.length - 1}
              >
                <div className={ACTION_CARD_CLASS}>
                  <CallItemContent
                    call={call}
                    audioSrc={`/api/cloudtalk/userCallMedia/${call.callId}`}
                    compact
                  />
                </div>
              </TimelineItem>
            ))}
          </div>
        )
      },
      sms: () => {
        if (smsThreads.length === 0) return <SectionEmptyState label='No SMS yet' />
        return (
          <div>
            {smsThreads.map((thread, index) => (
              <TimelineItem
                key={`sms-${thread.customerPhone}`}
                icon={MessageSquare}
                isLast={index === smsThreads.length - 1}
              >
                <div className={ACTION_CARD_CLASS}>
                  <SmsThreadCard thread={thread} compact />
                </div>
              </TimelineItem>
            ))}
          </div>
        )
      },
      emails: () => {
        if (sortedEmails.length === 0)
          return <SectionEmptyState label='No emails yet' />
        return (
          <div>
            {sortedEmails.map((email, index) => (
              <TimelineItem
                key={`email-${email.thread_id}-${email.id}`}
                icon={Mail}
                isLast={index === sortedEmails.length - 1}
              >
                <EmailHistoryRow email={email} />
              </TimelineItem>
            ))}
          </div>
        )
      },
      all: () => {
        if (allHistoryItems.length === 0)
          return <SectionEmptyState label='No history yet' />
        return (
          <div>
            {allHistoryItems.map((item, index) =>
              renderHistoryItem(item, index === allHistoryItems.length - 1),
            )}
          </div>
        )
      },
    }),
    [
      done,
      sortedNotes,
      sortedEmails,
      actions,
      smsThreads,
      allHistoryItems,
      dealId,
      onEdit,
      editingActivityId,
      noteHandlers,
      renderHistoryItem,
    ],
  )

  return (
    <div className='space-y-4'>
      <div>
        <SectionHeader label='To Do' count={todo.length} />
        {todo.length > 0 ? (
          <div>
            <AnimatePresence initial={false}>
              {todo.map((activity, index) => (
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
                  <TimelineItem icon={ClipboardIcon} isLast={index === todo.length - 1}>
                    <ActivityItem
                      activity={activity}
                      dealId={dealId}
                      onEdit={onEdit}
                      isBeingEdited={editingActivityId === activity.id}
                    />
                  </TimelineItem>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <SectionEmptyState label='No tasks yet' />
        )}
      </div>

      <div ref={historyHeaderRef}>
        <SectionHeader
          label='History'
          count={historyCount}
          collapsible
          isOpen={isHistoryOpen}
          onToggle={setIsHistoryOpen}
        />
        {isHistoryOpen && (
          <>
            <HistoryTabButtons
              activeTab={historyTab}
              onTabChange={setHistoryTab}
              activitiesCount={done.length}
              notesCount={notes.length}
              actionsCount={actions.length}
              smsThreadsCount={smsThreads.length}
              emailsCount={emails.length}
            />
            {tabRenderers[historyTab]()}
          </>
        )}
      </div>
    </div>
  )
}

// --- Main Component ---

export function DealActivityPanel({
  dealId,
  activities = [],
  notes = [],
  emails = [],
}: DealActivityPanelProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [editingActivity, setEditingActivity] = useState<DealActivity | null>(null)
  const [activeTab, setActiveTab] = useState<'activity' | 'notes'>('activity')
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyHeaderRef = useRef<HTMLDivElement>(null)

  const { data: callsData } = useQuery({
    queryKey: ['cloudtalk-deal-calls', dealId],
    queryFn: async () => {
      const r = await fetch(`/api/cloudtalk/dealCalls/${dealId}`)
      if (!r.ok) throw new Error(`CloudTalk ${r.status}`)
      return (await r.json()) as { items: Calls200Response[] }
    },
    enabled: !!dealId,
    staleTime: 60_000,
  })

  const actions = useMemo(() => {
    const raw = callsData?.items ?? []
    return raw
      .map(mapToCallEntry)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [callsData])

  const { data: smsData } = useQuery({
    queryKey: ['cloudtalk-deal-sms', dealId],
    queryFn: async () => {
      const r = await fetch(`/api/cloudtalk/dealSms/${dealId}`)
      if (!r.ok) throw new Error(`SMS ${r.status}`)
      return (await r.json()) as {
        items: SmsRow[]
        customerPhoneDigits: string[]
      }
    },
    enabled: !!dealId,
    staleTime: 60_000,
  })

  const smsThreads = useMemo(() => {
    const rows = smsData?.items ?? []
    const digits = smsData?.customerPhoneDigits ?? []
    const entries = rows.map(r => mapRowToSmsEntry(r, digits))
    return groupSmsIntoThreads(entries)
  }, [smsData])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('editActivity')
    if (raw === null || raw === '') return
    const id = Number.parseInt(raw, 10)
    const pathOnly = location.pathname

    const goReplace = () => {
      params.delete('editActivity')
      const qs = params.toString()
      navigate(qs ? `${pathOnly}?${qs}` : pathOnly, { replace: true })
    }

    if (!Number.isFinite(id)) {
      goReplace()
      return
    }

    const found = activities.find(a => a.id === id)
    if (found) {
      setEditingActivity(found)
      setActiveTab('activity')
    }
    goReplace()
  }, [activities, location.search, location.pathname, navigate])

  const handleEdit = (activity: DealActivity) => {
    setEditingActivity(activity)
    setActiveTab('activity')
  }

  const scrollToHistory = useCallback(() => {
    requestAnimationFrame(() => {
      const container = scrollRef.current
      const header = historyHeaderRef.current
      if (container && header) {
        const top =
          header.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop
        container.scrollTo({ top, behavior: 'smooth' })
      }
    })
  }, [])

  return (
    <div className='flex flex-col h-full'>
      <Tabs
        value={activeTab}
        onValueChange={value => {
          setActiveTab(value as 'activity' | 'notes')
          setEditingActivity(null)
        }}
      >
        <TabsList className='mb-3 grid grid-cols-2'>
          <TabsTrigger value='activity'>Activity</TabsTrigger>
          <TabsTrigger value='notes'>Notes</TabsTrigger>
        </TabsList>
        <TabsContent value='activity'>
          <ActivityForm
            dealId={dealId}
            editingActivity={editingActivity}
            onCancelEdit={() => setEditingActivity(null)}
          />
        </TabsContent>
        <TabsContent value='notes'>
          <NoteForm dealId={dealId} onNoteCreated={scrollToHistory} />
        </TabsContent>
      </Tabs>
      <div ref={scrollRef} className='flex-1 overflow-y-auto min-h-0'>
        <ActivityList
          dealId={dealId}
          activities={activities}
          notes={notes}
          actions={actions}
          smsThreads={smsThreads}
          emails={emails}
          onEdit={handleEdit}
          editingActivityId={editingActivity?.id ?? null}
          historyHeaderRef={historyHeaderRef}
        />
      </div>
    </div>
  )
}
