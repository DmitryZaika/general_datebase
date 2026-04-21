import { useWavesurfer } from '@wavesurfer/react'
import { Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '~/components/atoms/Spinner'
import { Nullable } from '~/types/utils'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function AudioWaveformPlayer({
  audioSrc,
  compact,
}: {
  audioSrc: string
  compact?: boolean
}) {
  const containerRef = useRef<Nullable<HTMLDivElement>>(null)
  const [error, setError] = useState(false)
  const height = compact ? 24 : 32

  const { wavesurfer, isReady, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    url: audioSrc,
    waveColor: '#cbd5e1',
    progressColor: '#3b82f6',
    height,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    cursorWidth: 0,
    normalize: true,
  })

  useEffect(() => {
    if (!wavesurfer) return
    const onError = () => setError(true)
    wavesurfer.on('error', onError)
    return () => {
      wavesurfer.un('error', onError)
    }
  }, [wavesurfer])

  const duration = wavesurfer?.getDuration() ?? 0

  const handlePlayPause = useCallback(() => {
    wavesurfer?.playPause()
  }, [wavesurfer])

  if (error) {
    return (
      <div className='flex items-center gap-2 w-full mt-1 text-xs text-slate-400'>
        Recording no longer available
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2 w-full mt-1'>
      <button
        type='button'
        onClick={handlePlayPause}
        disabled={!isReady}
        className='shrink-0 p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50'
      >
        {!isReady ? (
          <Spinner size={14} />
        ) : isPlaying ? (
          <Pause size={14} />
        ) : (
          <Play size={14} />
        )}
      </button>

      <div ref={containerRef} className='flex-1 min-w-0' style={{ height }} />

      {isReady && (
        <span className='shrink-0 text-xs text-slate-500 tabular-nums'>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      )}
    </div>
  )
}
