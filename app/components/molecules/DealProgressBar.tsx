import type { Nullable } from '~/types/utils'

interface StageInfo {
  id: number
  name: string
  position: number
}

interface StageHistory {
  list_id: number
  entered_at: string
  exited_at: Nullable<string>
}

interface DealProgressBarProps {
  stages: StageInfo[]
  history: StageHistory[]
  currentListId: number
  isClosed?: boolean
  closedAt?: Nullable<string>
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)

  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}`
  if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''}`
  return `${minutes} min`
}

function getStageDuration(
  stageId: number,
  history: StageHistory[],
  isClosed?: boolean,
  closedAt?: string | null,
): string | null {
  const entries = history.filter(h => h.list_id === stageId)
  if (entries.length === 0) return null

  const closedTime = closedAt ? new Date(closedAt).getTime() : null

  let totalMs = 0
  for (const entry of entries) {
    const start = new Date(entry.entered_at).getTime()
    const end = entry.exited_at
      ? new Date(entry.exited_at).getTime()
      : isClosed
        ? (closedTime ?? start)
        : Date.now()
    totalMs += end - start
  }

  return formatDuration(Math.max(0, totalMs))
}

function getClipPath(
  isFirst: boolean,
  isLast: boolean,
): string | undefined {
  if (isFirst && isLast) return undefined
  if (isFirst) return 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
  if (isLast) return 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%)'
  return 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)'
}

export function DealProgressBar({
  stages,
  history,
  currentListId,
  isClosed,
  closedAt,
}: DealProgressBarProps) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIndex = sorted.findIndex(s => s.id === currentListId)
  const effectiveIndex = currentIndex === -1 ? -1 : currentIndex

  return (
    <div className='w-full flex flex-col gap-1'>
      <div className='w-full flex overflow-hidden rounded-sm'>
        {sorted.map((stage, index) => {
          const isCompleted = index < effectiveIndex
          const isCurrent = index === effectiveIndex
          const isActive = isCompleted || isCurrent

          const duration = isActive
            ? getStageDuration(stage.id, history, isClosed, closedAt)
            : null
          const displayText = isActive ? (duration ?? '-') : '0 days'

          const isFirst = index === 0
          const isLast = index === sorted.length - 1

          return (
            <div
              key={stage.id}
              className='flex-1 min-w-0'
              style={{ marginRight: isLast ? 0 : -4 }}
            >
              <div
                className={`
                  flex items-center justify-center py-1.5 px-3 text-xs font-medium cursor-default select-none
                  ${isActive ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
                `}
                style={{
                  clipPath: getClipPath(isFirst, isLast),
                  paddingLeft: isFirst ? undefined : '14px',
                  paddingRight: isLast ? undefined : '14px',
                }}
              >
                <span className='truncate'>{displayText}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className='w-full flex'>
        {sorted.map((stage, index) => {
          const isCompleted = index < effectiveIndex
          const isCurrent = index === effectiveIndex
          const isActive = isCompleted || isCurrent

          return (
            <div
              key={stage.id}
              className='flex-1 min-w-0 text-center'
              style={{ marginRight: index === sorted.length - 1 ? 0 : -4 }}
            >
              <span
                className={`text-[10px] leading-tight truncate block ${
                  isCurrent
                    ? 'text-green-600 font-semibold'
                    : isActive
                      ? 'text-gray-600'
                      : 'text-gray-400'
                }`}
              >
                {stage.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
