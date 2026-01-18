import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export interface EmailTemplate {
  id: number
  template_name: string
  template_subject: string
  template_body: string
}

interface EmailTemplateSearchProps {
  companyId: number
  value?: EmailTemplate
  onChange: (template?: EmailTemplate) => void
}

interface TemplateItemProps {
  template: EmailTemplate
  onSelect: (template: EmailTemplate) => void
}

const TemplateItem = memo(function TemplateItem({ template, onSelect }: TemplateItemProps) {
  const previewText = template.template_body.replace(/<[^>]*>/g, '').slice(0, 50)

  return (
    <li
      className='px-3 py-2 hover:bg-gray-50 cursor-pointer'
      onMouseDown={() => onSelect(template)}
    >
      <div className='font-medium text-sm'>{template.template_name}</div>
      <div className='text-xs text-gray-500 truncate'>{previewText}...</div>
    </li>
  )
})

interface DropdownListProps {
  templates: EmailTemplate[]
  onSelect: (template: EmailTemplate) => void
}

const DropdownList = memo(function DropdownList({ templates, onSelect }: DropdownListProps) {
  return (
    <div className='absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg'>
      <ul className='py-1 divide-y divide-gray-100'>
        {templates.map(template => (
          <TemplateItem key={template.id} template={template} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  )
})

const fetchAllTemplates = async (companyId: number) => {
  const response = await fetch(`/api/email-templates/search/${companyId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch templates')
  }
  const data = await response.json()
  return data.templates as EmailTemplate[]
}

export function EmailTemplateSearch({
  companyId,
  value,
  onChange,
}: EmailTemplateSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: allTemplates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates', companyId],
    queryFn: () => fetchAllTemplates(companyId),
    enabled: isOpen,
    staleTime: 60000,
  })

  const filteredTemplates = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return allTemplates
    return allTemplates.filter(
      t =>
        t.template_name.toLowerCase().includes(query) ||
        t.template_body.toLowerCase().includes(query),
    )
  }, [allTemplates, inputValue])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setIsOpen(true)
  }, [])

  const handleSelect = useCallback(
    (template: EmailTemplate) => {
      onChange(template)
      setInputValue('')
      setIsOpen(false)
    },
    [onChange],
  )

  const handleClear = useCallback(() => {
    onChange(undefined)
    setInputValue('')
    setIsOpen(false)
  }, [onChange])

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    if (!value) {
      setIsOpen(true)
    }
  }, [value])

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 150)
  }, [])

  const showDropdown = isOpen && !value
  const hasTemplates = filteredTemplates.length > 0
  const showEmpty = showDropdown && !isLoading && !hasTemplates

  return (
    <div className='space-y-2'>
      <label className='text-sm font-medium'>Choose Template</label>
      <div className='relative'>
        {value && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleClear}
            className='absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 z-10 text-gray-500 hover:text-gray-700'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
        <Input
          placeholder='Search templates...'
          value={value ? value.template_name : inputValue}
          disabled={!!value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={value ? 'pr-10 bg-gray-50' : ''}
        />
        {isLoading && (
          <div className='absolute right-3 top-1/2 -translate-y-1/2'>
            <div className='animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent' />
          </div>
        )}

        {showDropdown && hasTemplates && (
          <DropdownList templates={filteredTemplates} onSelect={handleSelect} />
        )}

        {showEmpty && (
          <div className='absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm text-gray-500'>
            {inputValue.length > 0 ? 'No templates found' : 'No templates available'}
          </div>
        )}
      </div>
    </div>
  )
}
