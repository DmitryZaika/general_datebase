import { Loader2, Mail, User2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { parseEmailAddress } from '~/utils/stringHelpers'

interface RecipientSuggestion {
  id: number
  name: string
  email: string
  company_name: string | null
}

interface RecipientOption {
  key: string
  label: string
  email: string
  description: string
  kind: 'manual' | 'domain' | 'customer'
}

interface MultiEmailRecipientInputProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  companyId: number
  labels?: Record<string, string>
  onLabelsChange?: (labels: Record<string, string>) => void
}

function normalizeEmail(value: string): string {
  return parseEmailAddress(value).trim().toLowerCase()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
}

function parseRecipientTokens(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map(token => normalizeEmail(token))
    .filter(token => token.length > 0)
}

export function MultiEmailRecipientInput({
  value,
  onChange,
  disabled,
  companyId,
  labels,
  onLabelsChange,
}: MultiEmailRecipientInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedValue = useMemo(() => value.map(normalizeEmail), [value])
  const domainSuggestions = useMemo(() => {
    const raw = inputValue.trim()
    if (!raw.includes('@')) return []
    const [beforeAt, afterAt] = raw.split('@')
    if (!beforeAt || (raw.includes('.') && afterAt?.includes('.'))) return []

    const emailDomains = [
      '@gmail.com',
      '@yahoo.com',
      '@outlook.com',
      '@hotmail.com',
      '@aol.com',
      '@icloud.com',
    ]

    return emailDomains
      .filter(domain =>
        afterAt ? domain.toLowerCase().startsWith(`@${afterAt.toLowerCase()}`) : true,
      )
      .map(domain => normalizeEmail(`${beforeAt}${domain}`))
      .filter(email => !normalizedValue.includes(email))
      .slice(0, 5)
  }, [inputValue, normalizedValue])

  const addRecipients = (recipients: string[]) => {
    const next = [...normalizedValue]
    for (const recipient of recipients) {
      if (!isValidEmail(recipient)) continue
      if (!next.includes(recipient)) next.push(recipient)
    }
    onChange(next)
  }

  const addSingleRecipient = (recipient: string, displayName?: string) => {
    addRecipients([recipient])
    if (displayName && onLabelsChange) {
      const nextLabels = { ...labels, [normalizeEmail(recipient)]: displayName }
      onLabelsChange(nextLabels)
    }
    setInputValue('')
    setIsOpen(false)
  }

  const removeRecipient = (recipient: string) => {
    onChange(normalizedValue.filter(item => item !== recipient))
    if (onLabelsChange && labels) {
      const next = { ...labels }
      delete next[normalizeEmail(recipient)]
      onLabelsChange(next)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const term = inputValue.trim()
    if (disabled || term.length === 0) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    const timeout = window.setTimeout(async () => {
      try {
        const url = `/api/customers/email-recipients?term=${encodeURIComponent(term)}&companyId=${companyId}`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          setSuggestions([])
          return
        }
        const payload: { customers?: RecipientSuggestion[] } = await response.json()
        setSuggestions(payload.customers ?? [])
      } catch {
        if (!controller.signal.aborted) setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [companyId, disabled, inputValue])

  const manualEmailSuggestion =
    inputValue.trim().length > 0 && isValidEmail(inputValue)
      ? normalizeEmail(inputValue)
      : ''

  const visibleSuggestions = suggestions.filter(
    suggestion => !normalizedValue.includes(normalizeEmail(suggestion.email)),
  )

  const options = useMemo<RecipientOption[]>(() => {
    const next: RecipientOption[] = []

    if (manualEmailSuggestion && !normalizedValue.includes(manualEmailSuggestion)) {
      next.push({
        key: `manual-${manualEmailSuggestion}`,
        label: manualEmailSuggestion,
        email: manualEmailSuggestion,
        description: 'Add email address',
        kind: 'manual',
      })
    }

    for (const suggestion of domainSuggestions) {
      if (
        suggestion !== manualEmailSuggestion &&
        !next.some(option => option.email === suggestion)
      ) {
        next.push({
          key: `domain-${suggestion}`,
          label: suggestion,
          email: suggestion,
          description: 'Complete email',
          kind: 'domain',
        })
      }
    }

    for (const suggestion of visibleSuggestions) {
      const email = normalizeEmail(suggestion.email)
      if (!next.some(option => option.email === email)) {
        next.push({
          key: `customer-${suggestion.id}-${email}`,
          label: suggestion.name || email,
          email,
          description: suggestion.company_name || suggestion.email,
          kind: 'customer',
        })
      }
    }

    return next
  }, [domainSuggestions, manualEmailSuggestion, normalizedValue, visibleSuggestions])

  return (
    <div ref={rootRef} className='relative'>
      <div
        className={cn(
          'min-h-10 rounded-md border border-zinc-200 bg-transparent px-3 py-2',
          'focus-within:border-zinc-950 focus-within:ring-zinc-950/50 focus-within:ring-[3px]',
          disabled && 'pointer-events-none opacity-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <div className='flex flex-wrap items-center gap-2'>
          {normalizedValue.map(recipient => (
            <Badge key={recipient} variant='secondary' className='gap-1 pl-2 pr-1 py-1'>
              <span className='max-w-[240px] truncate' title={recipient}>
                {labels?.[recipient] ?? recipient}
              </span>
              <button
                type='button'
                className='inline-flex h-4 w-4 items-center justify-center rounded-sm'
                onClick={event => {
                  event.stopPropagation()
                  removeRecipient(recipient)
                }}
              >
                <X className='h-3 w-3' />
              </button>
            </Badge>
          ))}
          <input
            ref={inputRef}
            value={inputValue}
            type='text'
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              if (manualEmailSuggestion) addSingleRecipient(manualEmailSuggestion)
            }}
            onChange={event => {
              const raw = event.target.value
              if (/[\n,;]/.test(raw)) {
                const recipients = parseRecipientTokens(raw)
                addRecipients(recipients)
                setInputValue('')
                return
              }
              setInputValue(raw)
              setIsOpen(true)
            }}
            onPaste={event => {
              const pasted = event.clipboardData.getData('text')
              const recipients = parseRecipientTokens(pasted)
              if (recipients.length > 1) {
                event.preventDefault()
                addRecipients(recipients)
                setInputValue('')
              }
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
                if (options.length > 0) {
                  event.preventDefault()
                  const opt = options[0]
                  addSingleRecipient(
                    opt.email,
                    opt.kind === 'customer' ? opt.label : undefined,
                  )
                }
              }
              if (
                event.key === 'Backspace' &&
                inputValue.length === 0 &&
                normalizedValue.length > 0
              ) {
                removeRecipient(normalizedValue[normalizedValue.length - 1])
              }
            }}
            className='min-w-[220px] flex-1 border-0 bg-transparent px-0 py-0 text-sm outline-none'
            placeholder={normalizedValue.length === 0 ? 'recipient@example.com' : ''}
          />
        </div>
      </div>

      {isOpen && !disabled && (options.length > 0 || isLoading) ? (
        <div className='absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white shadow-lg'>
          {isLoading ? (
            <div className='flex items-center gap-2 px-3 py-2 text-sm text-zinc-500'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Searching...
            </div>
          ) : null}
          {!isLoading &&
            options.map(option => (
              <button
                key={option.key}
                type='button'
                className='flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-100 cursor-pointer'
                onMouseDown={event => event.preventDefault()}
                onClick={() =>
                  addSingleRecipient(
                    option.email,
                    option.kind === 'customer' ? option.label : undefined,
                  )
                }
              >
                <div className='mt-0.5 text-zinc-400'>
                  {option.kind === 'customer' ? (
                    <User2 className='h-4 w-4' />
                  ) : (
                    <Mail className='h-4 w-4' />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium'>{option.label}</div>
                  <div className='truncate text-xs text-zinc-500'>{option.email}</div>
                  <div className='truncate text-xs text-zinc-400'>
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  )
}
