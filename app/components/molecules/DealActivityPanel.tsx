import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
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
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { Link, useFetcher, useLocation, useNavigate, useParams } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import ClipboardIcon from '~/components/icons/ClipboardIcon'
import NoteIcon from '~/components/icons/NoteIcon'
import { CallItemContent } from '~/components/molecules/CallItemContent'
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
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Textarea } from '~/components/ui/textarea'
import { useToast } from '~/hooks/use-toast'
import { useNoteAction } from '~/hooks/useNoteAction'
import {
  buildDeadlinePayload,
  formatDeadlineLabel,
  formatPickerDeadline,
  formatTimestamp,
  localCalendarDate,
} from '~/lib/dateHelpers'
import { buildActivityApiAction } from '~/lib/dealApiHelpers'
import { cn } from '~/lib/utils'
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
import { phoneDigitsOnly } from '~/utils/phone'
import { mapRowToSmsEntry, type SmsEntry, type SmsRow } from '~/utils/smsDisplayHelpers'
import { stripHtmlTags } from '~/utils/stringHelpers'
import { NoteForm } from './NoteForm'
import { NoteItem } from './NoteItem'

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

function shouldShowCreatorAttribution(
  viewerName: string | null | undefined,
  creatorName: string | null | undefined,
): boolean {
  const c = creatorName?.trim()
  if (!c) return false
  const v = viewerName?.trim()
  if (!v) return true
  return v !== c
}

const ITEM_VARIANTS = {
  initial: { opacity: 0, height: 0, scale: 0.95 },
  animate: { opacity: 1, height: 'auto', scale: 1 },
  exit: { opacity: 0, height: 0, scale: 0.95 },
}

const ITEM_TRANSITION = { duration: 0.25, ease: 'easeInOut' as const }

const EMAIL_LIST_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.085,
      delayChildren: 0.05,
    },
  },
}

const EMAIL_ROW_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 0.72,
    },
  },
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
        ? localCalendarDate(action.payload.deadline)
        : undefined
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

function useActivityForm(dealId: number, editingActivityId: Nullable<number>) {
  const fetcher = useFetcher()
  const token = useAuthenticityToken()
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE)

  const isSubmitting = fetcher.state !== 'idle'
  const isValid = form.name.trim().length > 0
  const isEditing = editingActivityId !== null

  const submit = useCallback(() => {
    if (!isValid) return

    const payload: Record<string, string> = {
      intent: isEditing ? 'update' : 'create',
      name: form.name.trim(),
      deadline: buildDeadlinePayload(form.deadline),
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
      if (dealId <= 0) return
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
      } else {
        toast({
          title: 'Activity reactivated',
          description: `"${activityName}" moved to To Do`,
          variant: 'success',
        })
      }
    },
    [toggleFetcher.submit, dealId, toast, token],
  )

  const remove = useCallback(
    (activityId: number, activityName: string) => {
      if (dealId <= 0) return
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
    isToggling: dealId <= 0 ? false : toggleFetcher.state !== 'idle',
    isDeleting: dealId <= 0 ? false : deleteFetcher.state !== 'idle',
    togglingData: dealId <= 0 ? undefined : toggleFetcher.formData,
  }
}

function ActivityItemReadOnly({
  activity,
  viewerName,
}: {
  activity: DealActivity
  viewerName?: Nullable<string>
}) {
  const done = !!activity.is_completed
  const urgency: DeadlineUrgency =
    !done && activity.deadline
      ? formatDeadlineLabel(activity.deadline).urgency
      : 'normal'
  const when = formatTimestamp(activity.completed_at || activity.created_at)

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-md px-2 py-1.5',
        !done && URGENCY_BORDER_STYLE[urgency],
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          {done ? (
            <Badge className='h-4 shrink-0 border border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] text-gray-700'>
              Done
            </Badge>
          ) : null}
          <PriorityBadge priority={activity.priority} />
          {shouldShowCreatorAttribution(viewerName, activity.created_by) &&
          activity.created_by ? (
            <span className='min-w-0 truncate text-xs text-gray-500'>
              Created by {activity.created_by}
            </span>
          ) : null}
        </div>
        {when ? (
          <div className='flex shrink-0 flex-col items-end gap-0.5'>
            <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
              {when}
            </span>
          </div>
        ) : null}
      </div>
      <p className='mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800'>
        {activity.name}
      </p>
      {!done && activity.deadline ? (
        <div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
          <DeadlineLabel deadline={activity.deadline} />
        </div>
      ) : null}
    </div>
  )
}

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
  const { label, urgency } = formatDeadlineLabel(deadline)
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
      {label}
    </span>
  )
}

function SectionEmptyState({ label }: { label: string }) {
  return <p className='text-xs text-gray-400 py-3 text-center italic'>{label}</p>
}

function getFormDataNoteId(formData: FormData | undefined): Nullable<number> {
  const value = formData?.get('noteId')
  if (typeof value !== 'string') return null
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function NoteHistoryReadOnly({
  note,
  viewerName,
}: {
  note: DealNote
  viewerName?: Nullable<string>
}) {
  const pinned = !!note.is_pinned
  const when = formatTimestamp(note.created_at)
  const showCreatorLine =
    !!note.created_by && shouldShowCreatorAttribution(viewerName, note.created_by)

  return (
    <div className='flex flex-col gap-0.5 rounded-md px-2 py-1.5'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          {pinned ? (
            <Badge className='text-[10px] px-1.5 py-0 h-4 border bg-amber-100 text-amber-800 border-amber-200'>
              Pinned
            </Badge>
          ) : null}
        </div>
        <div className='flex shrink-0 flex-col items-end gap-0.5'>
          <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
            {when}
          </span>
          {showCreatorLine && note.created_by ? (
            <span className='max-w-[140px] truncate text-[9px] text-gray-400'>
              By {formatAttributionName(note.created_by)}
            </span>
          ) : null}
        </div>
      </div>
      <p className='mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800'>
        {note.content}
      </p>
      {note.comments.length > 0 ? (
        <div className='mt-2.5 space-y-1.5 border-l-2 border-gray-200 pl-3'>
          {note.comments.map(c => (
            <div key={c.id} className='flex flex-col gap-0.5'>
              <div className='flex justify-end'>
                <div className='flex flex-col items-end gap-0.5'>
                  <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
                    {formatTimestamp(c.created_at)}
                  </span>
                  {c.created_by ? (
                    <span className='max-w-[140px] truncate text-[9px] text-gray-400'>
                      By {formatAttributionName(c.created_by)}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className='text-xs text-gray-600 leading-relaxed'>{c.content}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function HistoryAsyncSkeleton({
  icon: Icon,
  count = 2,
}: {
  icon: typeof Phone
  count?: number
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <TimelineItem key={index} icon={Icon} isLast={index === count - 1}>
          <div className='flex flex-col gap-2 rounded-md border border-gray-200 px-2 py-2'>
            <Skeleton className='h-3 w-28' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-4/5' />
          </div>
        </TimelineItem>
      ))}
    </>
  )
}

function NoteHistorySkeletonItem({ isLast = false }: { isLast?: boolean }) {
  return (
    <TimelineItem icon={NoteIcon} isLast={isLast}>
      <div className='flex flex-col gap-0.5 rounded-md border border-gray-200 px-2 py-1.5'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <Skeleton className='h-3 w-32' />
          <div className='flex items-center gap-1'>
            <Skeleton className='h-6 w-20 rounded-md' />
            <Skeleton className='h-6 w-6 rounded-md' />
            <Skeleton className='h-6 w-6 rounded-md' />
          </div>
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
        </div>
      </div>
    </TimelineItem>
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

function ActivityItem({
  activity,
  dealId,
  onEdit,
  isBeingEdited,
  viewerName,
}: {
  activity: DealActivity
  dealId: number
  onEdit: (activity: DealActivity) => void
  isBeingEdited: boolean
  viewerName?: Nullable<string>
}) {
  const { toggle, remove, isToggling, isDeleting, togglingData } =
    useActivityAction(dealId)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isDone = !!activity.is_completed
  const optimisticDone = togglingData?.get('intent') === 'toggle' ? !isDone : isDone
  const urgency: DeadlineUrgency =
    !optimisticDone && activity.deadline
      ? formatDeadlineLabel(activity.deadline).urgency
      : 'normal'

  const deleteControl = (
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6 shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100'
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
  )

  if (optimisticDone) {
    return (
      <div
        className={cn(
          'group flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50',
          isDeleting && 'pointer-events-none scale-95 opacity-0',
          isBeingEdited && 'bg-blue-50 ring-1 ring-blue-200',
        )}
      >
        <div className='flex items-center justify-between gap-2'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <Checkbox
              checked={optimisticDone}
              onCheckedChange={() => toggle(activity.id, activity.name, isDone)}
              disabled={isToggling}
              className='mt-0.5 h-4 w-4 shrink-0'
            />
            <Badge className='h-4 shrink-0 border border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] text-gray-700'>
              Done
            </Badge>
            <PriorityBadge priority={activity.priority} />
            {shouldShowCreatorAttribution(viewerName, activity.created_by) &&
            activity.created_by ? (
              <span className='min-w-0 truncate text-xs text-gray-500'>
                Created by {activity.created_by}
              </span>
            ) : null}
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            {deleteControl}
            {activity.completed_at ? (
              <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
                {formatTimestamp(activity.completed_at)}
              </span>
            ) : null}
          </div>
        </div>
        <p className='mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800'>
          {activity.name}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50',
        isDeleting && 'pointer-events-none scale-95 opacity-0',
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

      <div className='min-w-0 flex-1'>
        <button
          type='button'
          onClick={() => onEdit(activity)}
          className={cn(
            'block w-full whitespace-pre-wrap break-words rounded px-0.5 -mx-0.5 text-left text-sm leading-tight',
            'hover:bg-gray-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 cursor-pointer',
          )}
        >
          {activity.name}
        </button>

        <div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
          <PriorityBadge priority={activity.priority} />
          {activity.deadline ? <DeadlineLabel deadline={activity.deadline} /> : null}
          {shouldShowCreatorAttribution(viewerName, activity.created_by) &&
          activity.created_by ? (
            <span className='px-1.5 py-0.5 text-[10px] text-gray-900'>
              Created by {activity.created_by}
            </span>
          ) : null}
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-0.5'>
        <Button
          variant='ghost'
          size='icon'
          className='h-6 w-6 shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-blue-500 group-hover:opacity-100 focus-visible:opacity-100'
          onClick={() => onEdit(activity)}
        >
          <Pencil className='h-3 w-3' />
        </Button>
        {deleteControl}
      </div>
    </div>
  )
}

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
  const currentMin = deadline.getMinutes()
  // Preserve any non-5-min value from the saved deadline as an extra option
  // so it shows as the selected item without silently rounding.
  const minuteOptions = MINUTES_5.includes(currentMin)
    ? MINUTES_5
    : [...MINUTES_5, currentMin].sort((a, b) => a - b)

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
              {minuteOptions.map(m => (
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

function ActivityForm({
  dealId,
  editingActivity,
  onCancelEdit,
}: {
  dealId: number
  editingActivity: Nullable<DealActivity>
  onCancelEdit: () => void
}) {
  const { form, dispatch, isSubmitting, isValid, isEditing, submit } = useActivityForm(
    dealId,
    editingActivity?.id ?? null,
  )
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [deadlineCalendarKey, setDeadlineCalendarKey] = useState(0)
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
    const activityName = form.name.trim()
    submit()
    if (isEditing) {
      toast({
        title: 'Activity updated',
        description: 'Changes saved',
        variant: 'success',
      })
      onCancelEdit()
    } else {
      toast({
        title: 'Activity created',
        description: `"${activityName}" added to To Do`,
        variant: 'success',
      })
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
        <Popover
          open={deadlineOpen}
          onOpenChange={open => {
            setDeadlineOpen(open)
            if (open) setDeadlineCalendarKey(k => k + 1)
          }}
        >
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
                {form.deadline ? formatPickerDeadline(form.deadline) : 'Deadline'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              key={deadlineCalendarKey}
              mode='single'
              defaultMonth={form.deadline ?? new Date()}
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

function makeEmailSnippet(body: Nullable<string> | undefined, max = 120): string {
  if (!body) return ''
  const text = stripHtmlTags(body)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function formatAttributionName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map(part => {
      if (!part) return ''
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .filter(Boolean)
    .join(' ')
}

function SmsHistoryRow({
  message,
  viewerName,
}: {
  message: SmsEntry
  viewerName?: Nullable<string>
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isOutbound = message.direction === 'outbound'
  const sentLabel = formatTimestamp(message.createdDate)
  const showToggle = message.text.length > 90
  const outboundAgent = isOutbound && message.agent ? message.agent : null
  const showAgentLine =
    !!outboundAgent && shouldShowCreatorAttribution(viewerName, outboundAgent)

  return (
    <div className='group flex flex-col gap-0.5 rounded-md px-2 py-1.5'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-start gap-2'>
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 border shrink-0',
              isOutbound
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-green-100 text-green-700 border-green-200',
            )}
          >
            {isOutbound ? 'Sent' : 'Received'}
          </Badge>
          <p
            className={cn(
              'min-w-0 text-xs leading-4 text-gray-500 break-words',
              !isExpanded && 'line-clamp-1',
            )}
          >
            {message.text}
          </p>
        </div>
        <div className='flex shrink-0 flex-col items-end gap-0.5'>
          <div className='flex items-center gap-2'>
            {showToggle ? (
              <button
                type='button'
                className='text-[10px] font-medium text-blue-600 opacity-0 transition-opacity hover:text-blue-700 group-hover:opacity-100 focus-visible:opacity-100'
                onClick={() => setIsExpanded(value => !value)}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
            <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
              {sentLabel}
            </span>
          </div>
          {showAgentLine ? (
            <span className='max-w-[140px] truncate text-[9px] text-gray-400'>
              By {formatAttributionName(outboundAgent)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function EmailHistoryRow({
  email,
  viewerName,
}: {
  email: DealEmailHistoryItem
  viewerName?: Nullable<string>
}) {
  const location = useLocation()
  const params = useParams()
  const isAdmin = location.pathname.includes('/admin/')
  const basePath = isAdmin ? '/admin/deals' : '/employee/deals'
  const currentDealId = params.dealId ?? ''
  const emailDealId = email.deal_id ? String(email.deal_id) : currentDealId
  const searchParams = new URLSearchParams(location.search)
  searchParams.set('messageId', String(email.id))
  const to = `${basePath}/edit/${emailDealId}/project/chat/${email.thread_id}?${searchParams.toString()}`

  const sentLabel = formatTimestamp(email.sent_at)
  const isSent = !!email.sender_user_id
  const isRead = isSent ? (email.read_count ?? 0) > 0 : !!email.employee_read_at
  const hasAttachments = !!email.has_attachments
  const snippet = makeEmailSnippet(email.body)
  const outboundSender = isSent && email.sender_name ? email.sender_name : null
  const showSenderLine =
    !!outboundSender && shouldShowCreatorAttribution(viewerName, outboundSender)

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
        <div className='flex shrink-0 flex-col items-end gap-0.5'>
          <div className='flex items-center gap-1.5'>
            <span className='flex w-3 items-center justify-center'>
              {hasAttachments ? (
                <Paperclip
                  className='h-3 w-3 text-gray-500'
                  aria-label='Has attachments'
                />
              ) : null}
            </span>
            <span className='flex w-3 items-center justify-center'>
              {isRead ? (
                <Eye className='h-3 w-3 text-blue-500' aria-label='Read' />
              ) : (
                <EyeClosed className='h-3 w-3 text-gray-400' aria-label='Unread' />
              )}
            </span>
            <span className='whitespace-nowrap text-right text-[11px] font-medium tabular-nums text-gray-700'>
              {sentLabel}
            </span>
          </div>
          {showSenderLine ? (
            <span className='max-w-[140px] truncate text-[9px] text-gray-400'>
              By {formatAttributionName(outboundSender)}
            </span>
          ) : null}
        </div>
      </div>
      {snippet ? (
        <p className='text-xs text-gray-500 line-clamp-1 break-words'>{snippet}</p>
      ) : null}
    </Link>
  )
}

function HistoryTabButtons({
  activeTab,
  onTabChange,
  activitiesCount,
  notesCount,
  actionsCount,
  smsCount,
  emailsCount,
}: {
  activeTab: HistoryTab
  onTabChange: (tab: HistoryTab) => void
  activitiesCount: number
  notesCount: number
  actionsCount: number
  smsCount: number
  emailsCount: number
}) {
  const tabs: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'activities', label: `Activities (${activitiesCount})` },
    { key: 'notes', label: `Notes (${notesCount})` },
    { key: 'actions', label: `Actions (${actionsCount})` },
    { key: 'sms', label: `SMS (${smsCount})` },
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

function historyItemMotionKey(
  item: HistoryItem,
  updatingNoteId: Nullable<number>,
): string {
  if (item.type === 'note' && updatingNoteId === item.data.id) {
    return `note-skeleton-${item.data.id}`
  }
  switch (item.type) {
    case 'activity':
      return `activity-${item.data.id}`
    case 'note':
      return `note-${item.data.id}`
    case 'action':
      return `action-${item.data.callId}`
    case 'sms':
      return `sms-${item.data.id}`
    case 'email':
      return `email-${item.data.thread_id}-${item.data.id}`
  }
}

function ActivityList({
  dealId,
  activities,
  notes,
  actions,
  smsMessages,
  emails,
  customerEmails,
  onEdit,
  editingActivityId,
  historyHeaderRef,
  viewerName,
  isActionsPending,
  isSmsPending,
  readOnly = false,
}: {
  dealId: number
  activities: DealActivity[]
  notes: DealNote[]
  actions: CallEntry[]
  smsMessages: SmsEntry[]
  emails: DealEmailHistoryItem[]
  customerEmails: DealEmailHistoryItem[]
  onEdit: (activity: DealActivity) => void
  editingActivityId: Nullable<number>
  historyHeaderRef: React.RefObject<Nullable<HTMLDivElement>>
  viewerName: string
  isActionsPending: boolean
  isSmsPending: boolean
  readOnly?: boolean
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const toggleHistoryOpen = useCallback(() => setIsHistoryOpen(prev => !prev), [])
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all')
  const [showCustomerEmails, setShowCustomerEmails] = useState(false)
  const noteHandlers = useNoteAction(dealId)
  const updatingNoteId =
    getFormDataNoteId(noteHandlers.editingData) ??
    getFormDataNoteId(noteHandlers.commentingData) ??
    getFormDataNoteId(noteHandlers.deletingData)

  const { todo, done } = useMemo(() => partitionActivities(activities), [activities])

  const historyActivitiesSorted = useMemo(() => {
    if (!readOnly) return done
    return [...activities].sort((a, b) => {
      const ta = new Date(a.completed_at || a.created_at).getTime()
      const tb = new Date(b.completed_at || b.created_at).getTime()
      return tb - ta
    })
  }, [readOnly, activities, done])

  const activitiesForHistoryTabs = readOnly ? historyActivitiesSorted : done

  const displayedEmails =
    showCustomerEmails && customerEmails.length > 0 ? customerEmails : emails

  const sortedEmails = useMemo(
    () =>
      [...displayedEmails].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      ),
    [displayedEmails],
  )

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }),
    [notes],
  )

  const allHistoryItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...activitiesForHistoryTabs.map(
        a =>
          ({
            type: 'activity',
            data: a,
            date: a.completed_at || a.created_at,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...notes.map(
        n =>
          ({
            type: 'note',
            data: n,
            date: n.created_at,
            isPinned: !!n.is_pinned,
          }) satisfies HistoryItem,
      ),
      ...actions.map(
        a =>
          ({
            type: 'action',
            data: a,
            date: a.startedAt,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...smsMessages.map(
        message =>
          ({
            type: 'sms',
            data: message,
            date: message.createdDate,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
      ...displayedEmails.map(
        e =>
          ({
            type: 'email',
            data: e,
            date: e.sent_at,
            isPinned: false,
          }) satisfies HistoryItem,
      ),
    ]

    items.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime()
    })

    return items
  }, [activitiesForHistoryTabs, notes, actions, smsMessages, displayedEmails])

  const historyCount =
    activitiesForHistoryTabs.length +
    notes.length +
    actions.length +
    smsMessages.length +
    displayedEmails.length

  const renderHistoryItem = useCallback(
    (item: HistoryItem, isLast: boolean): ReactNode => {
      switch (item.type) {
        case 'activity':
          return (
            <TimelineItem icon={ClipboardIcon} isLast={isLast}>
              {readOnly ? (
                <ActivityItemReadOnly activity={item.data} viewerName={viewerName} />
              ) : (
                <ActivityItem
                  activity={item.data}
                  dealId={dealId}
                  onEdit={onEdit}
                  isBeingEdited={editingActivityId === item.data.id}
                  viewerName={viewerName}
                />
              )}
            </TimelineItem>
          )
        case 'note':
          if (!readOnly && updatingNoteId === item.data.id) {
            return <NoteHistorySkeletonItem isLast={isLast} />
          }
          return (
            <TimelineItem icon={NoteIcon} isLast={isLast}>
              {readOnly ? (
                <NoteHistoryReadOnly note={item.data} viewerName={viewerName} />
              ) : (
                <NoteItem
                  note={item.data}
                  handlers={noteHandlers}
                  viewerName={viewerName}
                />
              )}
            </TimelineItem>
          )
        case 'action':
          return (
            <TimelineItem icon={Phone} isLast={isLast}>
              <CallItemContent
                call={item.data}
                audioSrc={`/api/cloudtalk/userCallMedia/${item.data.callId}`}
                compact
                historyCompact
              />
            </TimelineItem>
          )
        case 'sms':
          return (
            <TimelineItem icon={MessageSquare} isLast={isLast}>
              <SmsHistoryRow message={item.data} viewerName={viewerName} />
            </TimelineItem>
          )
        case 'email':
          return (
            <TimelineItem icon={Mail} isLast={isLast}>
              <EmailHistoryRow email={item.data} viewerName={viewerName} />
            </TimelineItem>
          )
      }
    },
    [
      dealId,
      onEdit,
      editingActivityId,
      noteHandlers,
      updatingNoteId,
      viewerName,
      readOnly,
    ],
  )

  const tabRenderers = useMemo<Record<HistoryTab, () => ReactNode>>(
    () => ({
      activities: () => {
        if (activitiesForHistoryTabs.length === 0)
          return (
            <SectionEmptyState
              label={readOnly ? 'No activities' : 'No completed activities'}
            />
          )
        return (
          <motion.div variants={EMAIL_LIST_VARIANTS} initial='hidden' animate='visible'>
            {activitiesForHistoryTabs.map((activity, index) => (
              <motion.div key={`activity-${activity.id}`} variants={EMAIL_ROW_VARIANTS}>
                <TimelineItem
                  icon={ClipboardIcon}
                  isLast={index === activitiesForHistoryTabs.length - 1}
                >
                  {readOnly ? (
                    <ActivityItemReadOnly activity={activity} viewerName={viewerName} />
                  ) : (
                    <ActivityItem
                      activity={activity}
                      dealId={dealId}
                      onEdit={onEdit}
                      isBeingEdited={editingActivityId === activity.id}
                      viewerName={viewerName}
                    />
                  )}
                </TimelineItem>
              </motion.div>
            ))}
          </motion.div>
        )
      },
      notes: () => {
        if (sortedNotes.length === 0) return <SectionEmptyState label='No notes yet' />
        return (
          <motion.div variants={EMAIL_LIST_VARIANTS} initial='hidden' animate='visible'>
            {sortedNotes.map((note, index) => {
              const isLast = index === sortedNotes.length - 1
              if (!readOnly && updatingNoteId === note.id) {
                return (
                  <motion.div
                    key={`note-skeleton-${note.id}`}
                    variants={EMAIL_ROW_VARIANTS}
                  >
                    <NoteHistorySkeletonItem isLast={isLast} />
                  </motion.div>
                )
              }
              return (
                <motion.div key={`note-${note.id}`} variants={EMAIL_ROW_VARIANTS}>
                  <TimelineItem icon={NoteIcon} isLast={isLast}>
                    {readOnly ? (
                      <NoteHistoryReadOnly note={note} viewerName={viewerName} />
                    ) : (
                      <NoteItem
                        note={note}
                        handlers={noteHandlers}
                        viewerName={viewerName}
                      />
                    )}
                  </TimelineItem>
                </motion.div>
              )
            })}
          </motion.div>
        )
      },
      actions: () => {
        if (isActionsPending) {
          return <HistoryAsyncSkeleton icon={Phone} />
        }
        if (actions.length === 0) return <SectionEmptyState label='No actions yet' />
        return (
          <motion.div variants={EMAIL_LIST_VARIANTS} initial='hidden' animate='visible'>
            {actions.map((call, index) => (
              <motion.div key={`action-${call.callId}`} variants={EMAIL_ROW_VARIANTS}>
                <TimelineItem icon={Phone} isLast={index === actions.length - 1}>
                  <CallItemContent
                    call={call}
                    audioSrc={`/api/cloudtalk/userCallMedia/${call.callId}`}
                    compact
                    historyCompact
                  />
                </TimelineItem>
              </motion.div>
            ))}
          </motion.div>
        )
      },
      sms: () => {
        if (isSmsPending) {
          return <HistoryAsyncSkeleton icon={MessageSquare} />
        }
        if (smsMessages.length === 0) return <SectionEmptyState label='No SMS yet' />
        return (
          <motion.div variants={EMAIL_LIST_VARIANTS} initial='hidden' animate='visible'>
            {smsMessages.map((message, index) => (
              <motion.div key={`sms-${message.id}`} variants={EMAIL_ROW_VARIANTS}>
                <TimelineItem
                  icon={MessageSquare}
                  isLast={index === smsMessages.length - 1}
                >
                  <SmsHistoryRow message={message} viewerName={viewerName} />
                </TimelineItem>
              </motion.div>
            ))}
          </motion.div>
        )
      },
      emails: () => {
        const content =
          sortedEmails.length === 0 ? (
            <SectionEmptyState label='No emails yet' />
          ) : (
            <motion.div
              key={`email-tab-${showCustomerEmails ? 'all' : 'deal'}-${sortedEmails.map(e => e.id).join('-')}`}
              variants={EMAIL_LIST_VARIANTS}
              initial='hidden'
              animate='visible'
            >
              {sortedEmails.map((email, index) => (
                <motion.div
                  key={`email-${email.thread_id}-${email.id}`}
                  variants={EMAIL_ROW_VARIANTS}
                >
                  <TimelineItem icon={Mail} isLast={index === sortedEmails.length - 1}>
                    <EmailHistoryRow email={email} viewerName={viewerName} />
                  </TimelineItem>
                </motion.div>
              ))}
            </motion.div>
          )

        return <div className='space-y-2'>{content}</div>
      },
      all: () => {
        if (allHistoryItems.length === 0)
          return <SectionEmptyState label='No history yet' />
        return (
          <motion.div variants={EMAIL_LIST_VARIANTS} initial='hidden' animate='visible'>
            {allHistoryItems.map((item, index) => (
              <motion.div
                key={historyItemMotionKey(item, updatingNoteId)}
                variants={EMAIL_ROW_VARIANTS}
              >
                {renderHistoryItem(item, index === allHistoryItems.length - 1)}
              </motion.div>
            ))}
          </motion.div>
        )
      },
    }),
    [
      done,
      activitiesForHistoryTabs,
      readOnly,
      sortedNotes,
      sortedEmails,
      customerEmails.length,
      showCustomerEmails,
      actions,
      smsMessages,
      isActionsPending,
      isSmsPending,
      allHistoryItems,
      dealId,
      onEdit,
      editingActivityId,
      noteHandlers,
      updatingNoteId,
      renderHistoryItem,
      viewerName,
    ],
  )

  return (
    <div className='space-y-4'>
      {!readOnly ? (
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
                    <TimelineItem
                      icon={ClipboardIcon}
                      isLast={index === todo.length - 1}
                    >
                      <ActivityItem
                        activity={activity}
                        dealId={dealId}
                        onEdit={onEdit}
                        isBeingEdited={editingActivityId === activity.id}
                        viewerName={viewerName}
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
      ) : null}

      <div ref={historyHeaderRef}>
        {!readOnly ? (
          <SectionHeader
            label='History'
            count={historyCount}
            collapsible
            isOpen={isHistoryOpen}
            onToggle={toggleHistoryOpen}
          />
        ) : null}
        {(readOnly || isHistoryOpen) && (
          <>
            <HistoryTabButtons
              activeTab={historyTab}
              onTabChange={setHistoryTab}
              activitiesCount={activitiesForHistoryTabs.length}
              notesCount={notes.length}
              actionsCount={actions.length}
              smsCount={smsMessages.length}
              emailsCount={displayedEmails.length}
            />
            {customerEmails.length > 0 ? (
              <div className='flex justify-center mb-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 rounded-full px-3 text-[11px]'
                  onClick={() => setShowCustomerEmails(prev => !prev)}
                >
                  {showCustomerEmails
                    ? 'Show only this deal'
                    : 'Show all emails with this customer'}
                </Button>
              </div>
            ) : null}
            <Fragment key={historyTab}>{tabRenderers[historyTab]()}</Fragment>
          </>
        )}
      </div>
    </div>
  )
}

export function DealActivityPanel({
  dealId,
  activities = [],
  notes = [],
  emails = [],
  customerEmails = [],
  currentUserName = '',
  readOnly = false,
  customerPhones,
}: DealActivityPanelProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [editingActivity, setEditingActivity] = useState<Nullable<DealActivity>>(null)
  const [activeTab, setActiveTab] = useState<'activity' | 'notes'>('activity')
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyHeaderRef = useRef<HTMLDivElement>(null)

  const hasCustomerPhones =
    readOnly && !!(customerPhones?.phone?.trim() || customerPhones?.phone2?.trim())

  const customerPhoneDigitsLocal = useMemo(
    () =>
      [customerPhones?.phone, customerPhones?.phone2]
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map(p => phoneDigitsOnly(p.trim()))
        .filter(d => d.length >= 10),
    [customerPhones?.phone, customerPhones?.phone2],
  )

  const { data: callsData, isPending: isCallsHistoryPending } = useQuery({
    queryKey: ['cloudtalk-deal-calls', dealId],
    queryFn: async () => {
      const r = await fetch(`/api/cloudtalk/dealCalls/${dealId}`)
      if (!r.ok) throw new Error(`CloudTalk ${r.status}`)
      return (await r.json()) as { items: Calls200Response[] }
    },
    enabled: !readOnly && !!dealId,
    staleTime: 60_000,
  })

  const { data: customerCallsData, isPending: isCustomerCallsPending } = useQuery({
    queryKey: [
      'cloudtalk-customer-calls',
      customerPhones?.phone ?? '',
      customerPhones?.phone2 ?? '',
    ],
    queryFn: async () => {
      const qs = new URLSearchParams()
      const p1 = customerPhones?.phone?.trim()
      const p2 = customerPhones?.phone2?.trim()
      if (p1) qs.set('phone', p1)
      if (p2) qs.set('phone2', p2)
      const r = await fetch(`/api/cloudtalk/customerCalls?${qs}`)
      if (!r.ok) throw new Error(`CloudTalk ${r.status}`)
      return (await r.json()) as { items: Calls200Response[] }
    },
    enabled: readOnly && hasCustomerPhones,
    staleTime: 60_000,
  })

  const mergedCallsData = readOnly ? customerCallsData : callsData

  const actions = useMemo(() => {
    const raw = mergedCallsData?.items ?? []
    return raw
      .map(mapToCallEntry)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [mergedCallsData])

  const { data: smsData, isPending: isSmsHistoryPending } = useQuery({
    queryKey: ['cloudtalk-deal-sms', dealId],
    queryFn: async () => {
      const r = await fetch(`/api/cloudtalk/dealSms/${dealId}`)
      if (!r.ok) throw new Error(`SMS ${r.status}`)
      return (await r.json()) as {
        items: SmsRow[]
        customerPhoneDigits: string[]
      }
    },
    enabled: !readOnly && !!dealId,
    staleTime: 60_000,
  })

  const { data: customerSmsData, isPending: isCustomerSmsPending } = useQuery({
    queryKey: [
      'cloudtalk-customer-sms',
      customerPhones?.phone ?? '',
      customerPhones?.phone2 ?? '',
    ],
    queryFn: async () => {
      const qs = new URLSearchParams()
      const p1 = customerPhones?.phone?.trim()
      const p2 = customerPhones?.phone2?.trim()
      if (p1) qs.set('phone', p1)
      if (p2) qs.set('phone2', p2)
      const r = await fetch(`/api/cloudtalk/customerSms?${qs}`)
      if (!r.ok) throw new Error(`SMS ${r.status}`)
      return (await r.json()) as {
        items: SmsRow[]
        customerPhoneDigits: string[]
      }
    },
    enabled: readOnly && hasCustomerPhones,
    staleTime: 60_000,
  })

  const mergedSmsData = readOnly ? customerSmsData : smsData

  const smsMessages = useMemo(() => {
    const rows = mergedSmsData?.items ?? []
    const digits =
      mergedSmsData?.customerPhoneDigits ?? (readOnly ? customerPhoneDigitsLocal : [])
    return rows
      .map(r => mapRowToSmsEntry(r, digits))
      .sort(
        (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
      )
  }, [mergedSmsData, readOnly, customerPhoneDigitsLocal])

  const isCallsPendingResolved = readOnly
    ? hasCustomerPhones
      ? isCustomerCallsPending
      : false
    : isCallsHistoryPending
  const isSmsPendingResolved = readOnly
    ? hasCustomerPhones
      ? isCustomerSmsPending
      : false
    : isSmsHistoryPending

  useEffect(() => {
    if (readOnly) return
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
  }, [readOnly, activities, location.search, location.pathname, navigate])

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

  const listDealId = readOnly ? 0 : dealId

  return (
    <div className='flex flex-col h-full'>
      {readOnly ? null : (
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
      )}
      <div
        ref={scrollRef}
        className={cn('flex-1 overflow-y-auto min-h-0', readOnly && 'min-h-[240px]')}
      >
        <ActivityList
          dealId={listDealId}
          activities={activities}
          notes={notes}
          actions={actions}
          smsMessages={smsMessages}
          emails={emails}
          customerEmails={customerEmails}
          onEdit={handleEdit}
          editingActivityId={editingActivity?.id ?? null}
          historyHeaderRef={historyHeaderRef}
          viewerName={currentUserName}
          isActionsPending={isCallsPendingResolved}
          isSmsPending={isSmsPendingResolved}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
