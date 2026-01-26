import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuill } from 'react-quilljs'
import {
  EMAIL_TEMPLATE_VARIABLES,
  VARIABLE_KEYS,
  formatVariableForTemplate,
  validateTemplateBody,
} from '~/utils/emailTemplateVariables'
import { setupQuillImageHandlers } from '~/utils/quillImageUpload'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

import 'quill/dist/quill.snow.css'

interface VariableRange {
  start: number
  end: number
  key: string
  isPredefined: boolean
}

interface QuillEditorWithVariablesProps {
  value: string
  onChange: (value: string) => void
  renderInsertButton?: (button: React.ReactNode) => React.ReactNode
  onValidationChange?: (isValid: boolean, error?: string) => void
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean'],
  ],
}

function findVariableRanges(text: string): VariableRange[] {
  const regex = /\{\{([^}]+)\}\}/g
  const ranges: VariableRange[] = []
  let match

  while ((match = regex.exec(text)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      key: match[1],
      isPredefined: VARIABLE_KEYS.includes(match[1]),
    })
  }

  return ranges
}

function findPredefinedVariableAtPosition(
  text: string,
  cursorPos: number,
): VariableRange | null {
  const ranges = findVariableRanges(text)

  for (const range of ranges) {
    if (!range.isPredefined) continue

    const isInside = cursorPos > range.start && cursorPos < range.end
    const isAtEnd = cursorPos === range.end
    const isAtStart = cursorPos === range.start

    if (isInside || isAtEnd || isAtStart) {
      return range
    }
  }

  return null
}

export function QuillEditorWithVariables({
  value,
  onChange,
  renderInsertButton,
  onValidationChange,
}: QuillEditorWithVariablesProps) {
  const { quill, quillRef } = useQuill({ modules: QUILL_MODULES })
  const isInternalChange = useRef(false)
  const imageHandlerSetup = useRef(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    if (quill && !imageHandlerSetup.current) {
      setupQuillImageHandlers(quill)
      imageHandlerSetup.current = true
    }
  }, [quill])

  const syncValueToEditor = useCallback(() => {
    if (!quill || isInternalChange.current) return

    const currentContent = quill.root.innerHTML
    if (currentContent !== value && value !== undefined) {
      quill.clipboard.dangerouslyPasteHTML(value)
    }
  }, [quill, value])

  useEffect(() => {
    syncValueToEditor()
    isInternalChange.current = false
  }, [syncValueToEditor])

  useEffect(() => {
    if (!quill) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const selection = quill.getSelection()
      if (!selection) return

      const text = quill.getText()
      const cursorPos = selection.index
      const range = findPredefinedVariableAtPosition(text, cursorPos)

      if (!range) return

      const isInside = cursorPos > range.start && cursorPos < range.end
      const isEditKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete'

      if (isInside && isEditKey) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (e.key === 'Backspace' && cursorPos === range.end) {
        e.preventDefault()
        quill.deleteText(range.start, range.end - range.start)
        quill.setSelection(range.start, 0)
        return
      }

      if (e.key === 'Delete' && cursorPos === range.start) {
        e.preventDefault()
        quill.deleteText(range.start, range.end - range.start)
      }
    }

    const handleTextChange = () => {
      isInternalChange.current = true
      const html = quill.root.innerHTML
      onChange(html)

      if (onValidationChange) {
        const text = quill.getText()
        const validation = validateTemplateBody(text)
        onValidationChange(validation.isValid, validation.error)
      }
    }

    quill.root.addEventListener('keydown', handleKeyDown)
    quill.on('text-change', handleTextChange)

    return () => {
      quill.root.removeEventListener('keydown', handleKeyDown)
      quill.off('text-change', handleTextChange)
    }
  }, [quill, onChange, onValidationChange])

  const handleInsertVariable = useCallback(
    (key: string) => {
      if (!quill) return

      const range = quill.getSelection(true)
      const variableText = formatVariableForTemplate(key)

      quill.insertText(range.index, variableText)
      quill.setSelection(range.index + variableText.length, 0)
      setIsDropdownOpen(false)
    },
    [quill],
  )

  const insertButton = (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button type='button' variant='outline' size='sm'>
          Insert Variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='max-h-64 overflow-y-auto'>
        {EMAIL_TEMPLATE_VARIABLES.map(variable => (
          <DropdownMenuItem
            key={variable.key}
            onClick={() => handleInsertVariable(variable.key)}
          >
            {variable.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className='quill-with-variables'>
      {renderInsertButton ? renderInsertButton(insertButton) : insertButton}
      <div className='quill-container h-64 flex flex-col'>
        <div ref={quillRef} className='flex-1 overflow-y-auto' />
      </div>
    </div>
  )
}
