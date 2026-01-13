import { useEffect, useRef } from 'react'
import { useQuill } from 'react-quilljs'

import 'quill/dist/quill.snow.css'

interface IQuillEditorProps {
  value: string
  onChange: (value: string) => void
}

export function QuillEditor({ value, onChange }: IQuillEditorProps) {
  const { quill, quillRef } = useQuill()
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (quill && !isInternalChange.current) {
      const currentContent = quill.root.innerHTML
      if (currentContent !== value && value !== undefined) {
        quill.clipboard.dangerouslyPasteHTML(value)
      }
    }
    isInternalChange.current = false
  }, [quill, value])

  useEffect(() => {
    if (quill) {
      quill.on('text-change', () => {
        isInternalChange.current = true
        onChange(quill.root.innerHTML)
      })
    }
  }, [quill, onChange])

  return (
    <div className='quill-container h-64 flex flex-col'>
      <div ref={quillRef} className='flex-1 overflow-y-auto' />
    </div>
  )
}
