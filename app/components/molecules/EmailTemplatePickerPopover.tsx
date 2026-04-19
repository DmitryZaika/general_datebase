import { useQuery } from '@tanstack/react-query'
import { Check, FileText, Search, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import type { Nullable } from '~/types/utils'
import {
  type EmailTemplate,
  fetchAllTemplates,
  filterTemplates,
  getTemplatePreview,
  TEMPLATE_STALE_TIME,
  templateQueryKey,
} from '~/utils/emailTemplates'

interface EmailTemplatePickerPopoverProps {
  companyId: number
  onSelect: (template: EmailTemplate) => void
  activeTemplateId?: Nullable<number>
}

interface TemplateItemProps {
  template: EmailTemplate
  isHighlighted: boolean
  isActive: boolean
  onSelect: (template: EmailTemplate) => void
  onMouseEnter: () => void
}

const TemplateItem = memo(function TemplateItem({
  template,
  isHighlighted,
  isActive,
  onSelect,
  onMouseEnter,
}: TemplateItemProps) {
  const previewText = getTemplatePreview(template.template_body)

  return (
    <li
      className={`px-3 py-2.5 cursor-pointer transition-colors ${
        isActive ? 'bg-blue-50' : isHighlighted ? 'bg-gray-50' : 'hover:bg-gray-50'
      }`}
      onMouseDown={() => onSelect(template)}
      onMouseEnter={onMouseEnter}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='font-medium text-sm truncate'>{template.template_name}</div>
        {isActive && <Check className='h-3.5 w-3.5 shrink-0 text-blue-600' />}
      </div>
      <div className='text-xs text-gray-400 truncate mt-0.5'>{previewText}</div>
    </li>
  )
})

export function EmailTemplatePickerPopover({
  companyId,
  onSelect,
  activeTemplateId,
}: EmailTemplatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const isKeyboardNav = useRef(false)

  const { data: allTemplates = [], isLoading } = useQuery({
    queryKey: templateQueryKey(companyId),
    queryFn: () => fetchAllTemplates(companyId),
    enabled: isOpen,
    staleTime: TEMPLATE_STALE_TIME,
  })

  const filteredTemplates = useMemo(
    () => filterTemplates(allTemplates, searchQuery),
    [allTemplates, searchQuery],
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
    setHighlightedIndex(-1)
  }, [])

  const handleSelect = useCallback(
    (template: EmailTemplate) => {
      onSelect(template)
      close()
    },
    [onSelect, close],
  )

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQuery])

  const showSearch = allTemplates.length > 4

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, close])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        } else {
          dropdownRef.current?.focus()
        }
      })
    }
  }, [isOpen, showSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const count = filteredTemplates.length
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        isKeyboardNav.current = true
        setHighlightedIndex(prev => (prev < count - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        isKeyboardNav.current = true
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : count - 1))
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault()
        const template = filteredTemplates[highlightedIndex]
        if (template) handleSelect(template)
      }
    },
    [filteredTemplates, highlightedIndex, handleSelect, close],
  )

  useEffect(() => {
    if (!isKeyboardNav.current || highlightedIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('li')
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    isKeyboardNav.current = false
  }, [highlightedIndex])

  return (
    <div ref={containerRef} className='relative'>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              size='icon'
              aria-label='Use template'
              onClick={() => (isOpen ? close() : setIsOpen(true))}
            >
              <FileText className='h-5 w-5' />
            </Button>
          </TooltipTrigger>
          {!isOpen && <TooltipContent side='top'>Templates</TooltipContent>}
        </Tooltip>
      </TooltipProvider>

      {isOpen && (
        <div
          ref={dropdownRef}
          className='absolute bottom-full mb-1 left-0 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg outline-none'
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div className='flex items-center justify-between px-3 py-2 border-b border-gray-100'>
            <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
              Templates
            </span>
            <button
              type='button'
              className='text-gray-400 hover:text-gray-600 transition-colors'
              onMouseDown={close}
            >
              <X className='h-3.5 w-3.5' />
            </button>
          </div>

          {showSearch && (
            <div className='p-2 border-b border-gray-100'>
              <div className='relative'>
                <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400' />
                <input
                  ref={inputRef}
                  type='text'
                  placeholder='Search...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>
          )}

          <ul
            ref={listRef}
            className='max-h-52 overflow-y-auto divide-y divide-gray-100'
          >
            {isLoading && (
              <li className='flex items-center justify-center py-6'>
                <div className='animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent' />
              </li>
            )}

            {!isLoading && filteredTemplates.length === 0 && (
              <li className='px-3 py-6 text-sm text-gray-400 text-center'>
                {searchQuery.length > 0
                  ? 'No templates found'
                  : 'No templates available'}
              </li>
            )}

            {!isLoading &&
              filteredTemplates.map((template, index) => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  isHighlighted={index === highlightedIndex}
                  isActive={template.id === activeTemplateId}
                  onSelect={handleSelect}
                  onMouseEnter={() => setHighlightedIndex(index)}
                />
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
