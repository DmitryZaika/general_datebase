import { useState } from 'react'
import { Button, type ButtonProps } from '~/components/ui/button'

type AiImproveButtonProps = {
  getText: () => string
  setText: (value: string) => void
  className?: string
  buttonVariant?: ButtonProps['variant']
  buttonSize?: ButtonProps['size']
  iconClassName?: string
}

export function AiImproveButton({
  getText,
  setText,
  className,
  buttonVariant = 'default',
  buttonSize = 'default',
  iconClassName,
}: AiImproveButtonProps) {
  const [loading, setLoading] = useState(false)

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
        throw new Error(`Failed to improve text: ${response.status} ${errorText}`)
      }

      const json: { body?: string } = await response.json()
      if (json.body && json.body.trim()) {
        setText(json.body.trim())
      }
    } catch (error) {
      alert(
        `Failed to improve text: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type='button'
      variant={buttonVariant}
      size={buttonSize}
      className={className}
      disabled={loading}
      onClick={handleClick}
    >
      <span className={iconClassName ?? 'text-lg leading-none text-white'}>✦</span>
    </Button>
  )
}


