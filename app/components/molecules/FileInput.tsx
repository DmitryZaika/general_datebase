import Compressor from 'compressorjs'
import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'
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

function getQuality(size: number): number {
  const SEVEN_MB = 7 * 1024 * 1024
  const FIVE_MB = 5 * 1024 * 1024
  const THREE_MB = 3 * 1024 * 1024
  const ONE_MB = 1 * 1024 * 1024

  if (size > SEVEN_MB) {
    return 0.3
  } else if (size > FIVE_MB) {
    return 0.35
  } else if (size > THREE_MB) {
    return 0.4
  } else if (size > ONE_MB) {
    return 0.5
  } else {
    return 0.7
  }
}

function compressToFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: getQuality(file.size),
      success(result) {
        if (result instanceof File) {
          resolve(result)
        } else {
          resolve(new File([result], file.name, { type: file.type || 'image/jpeg' }))
        }
      },
      error: reject,
    })
  })
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
      if (type === 'image' || (type === 'all' && file.type.startsWith('image/'))) {
        out.push(await compressToFile(file))
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
    if (type === 'image' || (type === 'all' && file.type.startsWith('image/'))) {
      new Compressor(file, {
        quality: getQuality(file.size),
        success(result) {
          if (result instanceof File) {
            props.onChange(result)
          } else {
            const tempFile = new File([result], 'temp.jpg')
            props.onChange(tempFile)
          }
          setInternalHasFiles(true)
        },
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
