import Compressor from 'compressorjs'
import { Input } from '~/components/ui/input'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

type BaseFileInputProps = {
  inputName?: string
  id: string
  label?: string
  type?: 'image' | 'pdf' | 'document' | 'all'
  className?: string
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

export function FileInput(props: FileInputProps) {
  const { id, label = 'File', type = 'all', className } = props

  async function runMultiFromList(files: FileList | null) {
    if (props.multiple !== true) return
    if (!files?.length) {
      props.onChange([])
      return
    }
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
  }

  function runSingleFromFile(file: File | undefined) {
    if (props.multiple === true) return
    if (!file) return
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
        },
      })
    } else {
      props.onChange(file)
    }
  }

  const isMulti = props.multiple === true

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          className={className}
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
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
