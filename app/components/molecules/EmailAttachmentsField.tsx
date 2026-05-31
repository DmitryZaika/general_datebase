import { FileText, ImageIcon, Package, PaperclipIcon, Upload, X } from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useFormContext } from 'react-hook-form'
import { AttachmentImagePicker } from '~/components/AttachmentImagePicker'
import { AttachmentImageEditorDialog } from '~/components/molecules/AttachmentImageEditorDialog'
import { CustomDropdownMenu } from '~/components/molecules/DropdownMenu'
import { Button } from '~/components/ui/button'
import {
  attachmentPreviewKey,
  buildImageAttachmentPreviews,
  isImageFileName,
} from '~/utils/emailAttachmentUi'
import type { EmailTemplateAttachment } from '~/utils/emailTemplates'

interface EmailAttachmentsFormValues {
  attachments: File[]
  removed_attachment_ids: number[]
}

interface EmailAttachmentsContextValue {
  companyId: number
  existingAttachments: EmailTemplateAttachment[]
  visibleExistingAttachments: EmailTemplateAttachment[]
  newAttachments: File[]
  hasAttachmentChanges: boolean
  menuButton: ReactNode
  previews: ReactNode
  pickers: ReactNode
  editorDialog: ReactNode
}

const EmailAttachmentsContext = createContext<EmailAttachmentsContextValue | null>(null)

function useEmailAttachmentsContext() {
  const context = useContext(EmailAttachmentsContext)
  if (!context) {
    throw new Error(
      'Email attachment components must be used within EmailAttachmentsProvider',
    )
  }
  return context
}

function renderAttachmentIcon(fileName: string) {
  if (isImageFileName(fileName)) {
    return <ImageIcon className='h-4 w-4' />
  }
  return <FileText className='h-8 sm:h-15 w-8 sm:w-15' />
}

interface EmailAttachmentsProviderProps {
  companyId: number
  existingAttachments?: EmailTemplateAttachment[]
  children: ReactNode
}

export function EmailAttachmentsProvider({
  companyId,
  existingAttachments = [],
  children,
}: EmailAttachmentsProviderProps) {
  const form = useFormContext<EmailAttachmentsFormValues>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showStonesPicker, setShowStonesPicker] = useState(false)
  const [showImagesPicker, setShowImagesPicker] = useState(false)
  const [showDocumentsPicker, setShowDocumentsPicker] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [editingAttachment, setEditingAttachment] = useState<File | null>(null)

  const newAttachments = form.watch('attachments') ?? []
  const removedAttachmentIds = form.watch('removed_attachment_ids') ?? []

  const visibleExistingAttachments = useMemo(
    () => existingAttachments.filter(item => !removedAttachmentIds.includes(item.id)),
    [existingAttachments, removedAttachmentIds],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      form.setValue('attachments', [...form.getValues('attachments'), ...files], {
        shouldDirty: true,
      })
      setPreviews(prev => ({
        ...prev,
        ...buildImageAttachmentPreviews(files),
      }))
    },
    [form],
  )

  const removeNewAttachment = useCallback(
    (index: number) => {
      const attachments = form.getValues('attachments')
      const file = attachments[index]
      if (file) {
        const previewKey = attachmentPreviewKey(file)
        setPreviews(prev => {
          const next = { ...prev }
          const url = next[previewKey]
          if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
          delete next[previewKey]
          return next
        })
      }
      setEditingAttachment(current => (current === file ? null : current))
      form.setValue(
        'attachments',
        attachments.filter((_, itemIndex) => itemIndex !== index),
        { shouldDirty: true },
      )
    },
    [form],
  )

  const removeExistingAttachment = useCallback(
    (attachmentId: number) => {
      const current = form.getValues('removed_attachment_ids')
      if (current.includes(attachmentId)) return
      form.setValue('removed_attachment_ids', [...current, attachmentId], {
        shouldDirty: true,
      })
    },
    [form],
  )

  const replaceAttachment = useCallback(
    (originalFile: File, editedFile: File) => {
      const originalKey = attachmentPreviewKey(originalFile)
      setPreviews(prev => {
        const next = { ...prev }
        const oldUrl = next[originalKey]
        if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
        delete next[originalKey]
        next[attachmentPreviewKey(editedFile)] = URL.createObjectURL(editedFile)
        return next
      })
      const list = form.getValues('attachments')
      form.setValue(
        'attachments',
        list.map(file => (file === originalFile ? editedFile : file)),
        { shouldDirty: true },
      )
      setEditingAttachment(null)
    },
    [form],
  )

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
    event.currentTarget.value = ''
  }

  const openAttachment = (file: File) => {
    const fileUrl = URL.createObjectURL(file)
    window.open(fileUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 30_000)
  }

  const openExistingAttachment = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const editingAttachmentPreviewUrl = editingAttachment
    ? previews[attachmentPreviewKey(editingAttachment)]
    : undefined

  const hasAttachmentChanges =
    newAttachments.length > 0 || removedAttachmentIds.length > 0

  const menuButton = (
    <>
      <input
        ref={fileInputRef}
        type='file'
        className='hidden'
        multiple
        onChange={handleFileChange}
      />
      <CustomDropdownMenu
        side='top'
        trigger={
          <Button type='button' size='icon' aria-label='Attachment'>
            <PaperclipIcon className='h-4 w-4' />
          </Button>
        }
        sections={[
          {
            options: [
              {
                label: 'Upload from computer',
                icon: <Upload className='h-4 w-4' />,
                onClick: () => fileInputRef.current?.click(),
              },
              {
                label: 'From Stones',
                icon: <Package className='h-4 w-4' />,
                onClick: () => setShowStonesPicker(true),
              },
              {
                label: 'From Images',
                icon: <ImageIcon className='h-4 w-4' />,
                onClick: () => setShowImagesPicker(true),
              },
              {
                label: 'From Documents',
                icon: <FileText className='h-4 w-4' />,
                onClick: () => setShowDocumentsPicker(true),
              },
            ],
          },
        ]}
      />
    </>
  )

  const previewsNode =
    visibleExistingAttachments.length > 0 || newAttachments.length > 0 ? (
      <div className='flex flex-wrap gap-2 mb-4'>
        {visibleExistingAttachments.map(attachment => (
          <div
            key={`existing-${attachment.id}`}
            className='group relative size-15 sm:size-25 shrink-0 rounded border border-border overflow-hidden'
          >
            <button
              type='button'
              className='absolute top-0 right-0 z-10 p-0.5 rounded-bl bg-black/60 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80'
              onClick={event => {
                event.stopPropagation()
                removeExistingAttachment(attachment.id)
              }}
              aria-label='Remove attachment'
            >
              <X className='h-3 w-3 sm:h-4 sm:w-4' />
            </button>
            <button
              type='button'
              className='size-full flex items-center justify-center bg-muted text-muted-foreground cursor-pointer group-hover:bg-muted/80 transition-colors'
              onClick={event => {
                event.stopPropagation()
                openExistingAttachment(attachment.url)
              }}
            >
              {isImageFileName(attachment.filename) ? (
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className='size-full object-cover'
                />
              ) : (
                renderAttachmentIcon(attachment.filename)
              )}
            </button>
            <div className='absolute inset-0 pointer-events-none bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
              <span className='text-white text-[10px] text-center line-clamp-2 break-all select-none px-1'>
                {attachment.filename}
              </span>
            </div>
          </div>
        ))}
        {newAttachments.map((file, index) => {
          const previewKey = attachmentPreviewKey(file)
          const previewUrl = previews[previewKey]
          return (
            <div
              key={`new-${previewKey}`}
              className='group relative size-15 sm:size-25 shrink-0 rounded border border-border overflow-hidden'
            >
              <button
                type='button'
                className='absolute top-0 right-0 z-10 p-0.5 rounded-bl bg-black/60 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100 hover:bg-black/80'
                onClick={event => {
                  event.stopPropagation()
                  removeNewAttachment(index)
                }}
                aria-label='Remove attachment'
              >
                <X className='h-3 w-3 sm:h-4 sm:w-4' />
              </button>
              {previewUrl ? (
                <button
                  type='button'
                  className='size-full cursor-pointer block focus:outline-none'
                  onClick={event => {
                    event.stopPropagation()
                    setEditingAttachment(file)
                  }}
                >
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className='size-full object-cover transition-all group-hover:grayscale group-hover:brightness-75'
                  />
                </button>
              ) : (
                <button
                  type='button'
                  className='size-full flex items-center justify-center bg-muted text-muted-foreground cursor-pointer group-hover:bg-muted/80 transition-colors'
                  onClick={event => {
                    event.stopPropagation()
                    openAttachment(file)
                  }}
                >
                  {renderAttachmentIcon(file.name)}
                </button>
              )}
              <div className='absolute inset-0 pointer-events-none bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                <span className='text-white text-[10px] text-center line-clamp-2 break-all select-none px-1'>
                  {file.name}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    ) : null

  const pickers = (
    <>
      <AttachmentImagePicker
        type='stones'
        companyId={companyId}
        open={showStonesPicker}
        onClose={() => setShowStonesPicker(false)}
        onSelect={files => {
          addFiles(files)
          setShowStonesPicker(false)
        }}
        onAddFiles={addFiles}
      />
      <AttachmentImagePicker
        type='images'
        companyId={companyId}
        open={showImagesPicker}
        onClose={() => setShowImagesPicker(false)}
        onSelect={files => {
          addFiles(files)
          setShowImagesPicker(false)
        }}
      />
      <AttachmentImagePicker
        type='documents'
        companyId={companyId}
        open={showDocumentsPicker}
        onClose={() => setShowDocumentsPicker(false)}
        onSelect={files => {
          addFiles(files)
          setShowDocumentsPicker(false)
        }}
      />
    </>
  )

  const editorDialog = (
    <AttachmentImageEditorDialog
      file={editingAttachment}
      previewUrl={editingAttachmentPreviewUrl}
      open={!!editingAttachment}
      onOpenChange={open => {
        if (!open) setEditingAttachment(null)
      }}
      onSave={file => {
        if (editingAttachment) replaceAttachment(editingAttachment, file)
      }}
    />
  )

  const value: EmailAttachmentsContextValue = {
    companyId,
    existingAttachments,
    visibleExistingAttachments,
    newAttachments,
    hasAttachmentChanges,
    menuButton,
    previews: previewsNode,
    pickers,
    editorDialog,
  }

  return (
    <EmailAttachmentsContext.Provider value={value}>
      {children}
    </EmailAttachmentsContext.Provider>
  )
}

export function EmailAttachmentsPreviews() {
  const { previews } = useEmailAttachmentsContext()
  return previews
}

export function EmailAttachmentMenuButton() {
  const { menuButton } = useEmailAttachmentsContext()
  return menuButton
}

export function EmailAttachmentsDialogs() {
  const { pickers, editorDialog } = useEmailAttachmentsContext()
  return (
    <>
      {pickers}
      {editorDialog}
    </>
  )
}

export function useEmailAttachmentChanges() {
  const { hasAttachmentChanges } = useEmailAttachmentsContext()
  return hasAttachmentChanges
}
