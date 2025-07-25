import Compressor from 'compressorjs'
import { Input } from '~/components/ui/input'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

type FileInput = {
  inputName?: string
  id: string
  label?: string
  type?: 'image' | 'pdf' | 'document' | 'all'
  className?: string
  onChange: (event: File | undefined) => void
}

const acceptsMap = {
  image:
    'image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml, image/tiff, image/bmp, image/x-icon, image/heif, image/x-canon-cr2, image/x-nikon-nef',
  pdf: 'application/pdf',

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

export function FileInput({
  onChange,
  id,
  label = 'File',
  type = 'all',
  className,
}: FileInput) {
  function compressImage(file: File) {
    new Compressor(file, {
      quality: getQuality(file.size),
      success(result) {
        if (result instanceof File) {
          onChange(result)
        } else {
          const tempFile = new File([result], 'temp.jpg')
          onChange(tempFile)
        }
      },
    })
  }

  function handleChange(file: File | undefined) {
    if (!file) return
    if (type === 'image' || (type === 'all' && file.type.startsWith('image/'))) {
      compressImage(file)
    } else {
      onChange(file)
    }
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          className={className}
          onChange={event => handleChange(event.target.files?.[0])}
          type='file'
          accept={acceptsMap[type as keyof typeof acceptsMap]}
          id={id}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
