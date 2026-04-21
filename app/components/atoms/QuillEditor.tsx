import { useCallback, useEffect, useRef } from 'react'
import { useQuill } from 'react-quilljs'
import { setupQuillImageHandlers } from '~/utils/quillImageUpload'

import 'quill/dist/quill.snow.css'

interface IQuillEditorProps {
  value: string
  onChange: (value: string) => void
  onFilesDrop?: (files: File[]) => void
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

export function QuillEditor({ value, onChange, onFilesDrop }: IQuillEditorProps) {
  const { quill, quillRef } = useQuill({ modules: QUILL_MODULES })
  const isInternalChange = useRef(false)
  const imageHandlerSetup = useRef(false)

  useEffect(() => {
    if (quill && !imageHandlerSetup.current) {
      setupQuillImageHandlers(quill)
      imageHandlerSetup.current = true
    }
  }, [quill])

  useEffect(() => {
    if (quill && !isInternalChange.current) {
      const currentContent = quill.root.innerHTML
      if (currentContent !== value && value !== undefined) {
        quill.clipboard.dangerouslyPasteHTML(value)
        quill.setSelection(quill.getLength(), 0)
      }
    }
    isInternalChange.current = false
  }, [quill, value])

  const handleTextChange = useCallback(() => {
    if (quill) {
      isInternalChange.current = true
      onChange(quill.root.innerHTML)
    }
  }, [quill, onChange])

  useEffect(() => {
    if (quill) {
      quill.on('text-change', handleTextChange)
      return () => {
        quill.off('text-change', handleTextChange)
      }
    }
  }, [quill, handleTextChange])

  const handleDropCapture = useCallback(
    (e: React.DragEvent) => {
      const files = e.dataTransfer?.files
      if (files && files.length > 0 && onFilesDrop) {
        e.preventDefault()
        e.stopPropagation()
        onFilesDrop(Array.from(files))
      }
    },
    [onFilesDrop],
  )

  return (
    <div
      className='quill-container h-64 flex flex-col [&_.ql-editor]:max-md:text-base'
      onDropCapture={handleDropCapture}
    >
      <div ref={quillRef} className='flex-1 overflow-y-auto' />
    </div>
  )
}
