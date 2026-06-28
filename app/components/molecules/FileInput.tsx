import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'
import {
  compressImageFile,
  isCompressibleImageFile,
} from '~/utils/compressImage.client'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

type BaseFileInputProps = {
  inputName?: string
  id: string
  label?: string
  type?: 'image' | 'pdf' | 'document' | 'all'
  className?: string
  selectedFiles?: File | File[]
}

type SingleFileInputProps = BaseFileInputProps & {
  multiple?: false
  onChange: (file: File | undefined) => void
}

type MultiFileInputProps = BaseFileInputProps & {
  multiple: true
  onChange: (files: File[]) => void
}

type FileInputProps = SingleFileInputProps | MultiFileInputProps

type FileInputType = NonNullable<BaseFileInputProps['type']>

const acceptsMap: Record<FileInputType, string> = {
  image:
    'image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml, image/tiff, image/bmp, image/x-icon, image/heif, image/x-canon-cr2, image/x-nikon-nef',
  pdf: 'application/pdf',
  document:
    'application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/plain, text/csv',
  all: '*/*',
}

function clearNativeInput(id: string) {
  const el = document.getElementById(id)
  if (el instanceof HTMLInputElement) {
    el.value = ''
  }
}

export function FileInput(props: FileInputProps) {
  const { id, label = 'File', type = 'all', className } = props
  const [internalHasFiles, setInternalHasFiles] = useState(false)
  const isMulti = props.multiple === true

  const filesProp = 'selectedFiles' in props ? props.selectedFiles : undefined
  const hasFromParent =
    filesProp !== undefined &&
    (isMulti
      ? Array.isArray(filesProp) && filesProp.length > 0
      : filesProp instanceof File)

  const showClear = hasFromParent || internalHasFiles

  async function runMultiFromList(files: FileList | null) {
    if (props.multiple !== true) return
    if (!files?.length) {
      props.onChange([])
      setInternalHasFiles(false)
      return
    }
    setInternalHasFiles(true)
    const list = Array.from(files)
    const out: File[] = []
    for (const file of list) {
      if (type === 'image' || (type === 'all' && isCompressibleImageFile(file))) {
        out.push(await compressImageFile(file))
      } else {
        out.push(file)
      }
    }
    props.onChange(out)
    setInternalHasFiles(out.length > 0)
  }

  function runSingleFromFile(file: File | undefined) {
    if (props.multiple === true) return
    if (!file) {
      props.onChange(undefined)
      setInternalHasFiles(false)
      return
    }
    setInternalHasFiles(true)
    if (type === 'image' || (type === 'all' && isCompressibleImageFile(file))) {
      void compressImageFile(file).then(compressed => {
        props.onChange(compressed)
        setInternalHasFiles(true)
      })
    } else {
      props.onChange(file)
      setInternalHasFiles(true)
    }
  }

  function handleClear() {
    clearNativeInput(id)
    setInternalHasFiles(false)
    if (isMulti) {
      props.onChange([])
    } else {
      props.onChange(undefined)
    }
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className='relative w-full min-w-0'>
          <Input
            className={cn(className, showClear && 'pr-10')}
            onChange={event => {
              if (isMulti) {
                void runMultiFromList(event.target.files)
              } else {
                runSingleFromFile(event.target.files?.[0])
              }
            }}
            type='file'
            accept={acceptsMap[type]}
            id={id}
            multiple={isMulti}
          />
          {showClear ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 shrink-0 text-muted-foreground hover:text-foreground'
              onClick={handleClear}
              aria-label='Remove selected file'
            >
              <X className='h-4 w-4' />
            </Button>
          ) : null}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
