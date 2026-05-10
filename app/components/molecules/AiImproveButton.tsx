import { useState } from 'react'
import { Button, type ButtonProps } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useToast } from '~/hooks/use-toast'
import { friendlyAIError } from '~/hooks/useAIStream'

type AiImproveButtonProps = {
  id?: string
  getText: () => string
  setText: (value: string) => void
  className?: string
  buttonVariant?: ButtonProps['variant']
  buttonSize?: ButtonProps['size']
  iconClassName?: string
}

export function AiImproveButton({
  id,
  getText,
  setText,
  className,
  buttonVariant = 'default',
  buttonSize = 'default',
  iconClassName,
}: AiImproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    if (loading) return
    const text = getText()
    const body = text.trim()
    if (!body) return

    setLoading(true)
    try {
      const response = await fetch('/api/aiImprove/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`${response.status} ${errorText}`)
      }

      const json: { body?: string } = await response.json()
      if (json.body?.trim()) {
        setText(json.body.trim())
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unknown error'
      toast({
        title: 'Could not improve text',
        description: friendlyAIError(raw),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={id}
          type='button'
          variant={buttonVariant}
          size={buttonSize}
          className={className}
          disabled={loading}
          onClick={handleClick}
        >
          <span className={iconClassName ?? 'text-lg leading-none text-white'}>✦</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={6}>
        Improve Text
      </TooltipContent>
    </Tooltip>
  )
}
