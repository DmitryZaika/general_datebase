import { useEffect, useRef, useState } from 'react'
import type {
  ControllerRenderProps,
  FieldValues,
  Path,
  PathValue,
} from 'react-hook-form'
import { useFormContext } from 'react-hook-form'
import { FileInput } from '~/components/molecules/FileInput'
import { FormControl, FormItem, FormLabel, FormMessage } from '~/components/ui/form'
import {
  MAX_COMPANY_LOGO_HEIGHT,
  MIN_COMPANY_LOGO_HEIGHT,
  resolveCompanyLogoHeight,
} from '~/utils/companyLogo'
import {
  compressImageFile,
  isCompressibleImageFile,
  resizeImageToMaxHeight,
} from '~/utils/compressImage.client'

type CompanyLogoInputProps<T extends FieldValues> = {
  currentLogoUrl: string | null
  field: ControllerRenderProps<T, Path<T>>
}

async function prepareLogoFile(file: File, maxHeight: number): Promise<File> {
  const compressed = isCompressibleImageFile(file)
    ? await compressImageFile(file)
    : file
  return resizeImageToMaxHeight(compressed, maxHeight)
}

export function CompanyLogoInput<
  T extends FieldValues & { logo_height?: number | null },
>({ currentLogoUrl, field }: CompanyLogoInputProps<T>) {
  const form = useFormContext<T>()
  const logoHeight = resolveCompanyLogoHeight(form.watch('logo_height' as Path<T>))
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const originalFileRef = useRef<File | undefined>()
  const previewUrlRef = useRef<string | null>(currentLogoUrl)

  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  useEffect(() => {
    if (originalFileRef.current) return
    setPreviewUrl(currentLogoUrl)
  }, [currentLogoUrl])

  useEffect(() => {
    return () => {
      const url = previewUrlRef.current
      if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  function setPreview(nextUrl: string | null) {
    const previous = previewUrlRef.current
    if (previous?.startsWith('blob:') && previous !== nextUrl) {
      URL.revokeObjectURL(previous)
    }
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }

  function setLogoHeight(nextHeight: number) {
    form.setValue('logo_height' as Path<T>, nextHeight as PathValue<T, Path<T>>, {
      shouldDirty: true,
    })
  }

  async function applyLogoFile(file: File | undefined, maxHeight: number) {
    if (!file) {
      originalFileRef.current = undefined
      field.onChange(undefined)
      setPreview(currentLogoUrl)
      return
    }

    originalFileRef.current = file
    const prepared = await prepareLogoFile(file, maxHeight)
    field.onChange(prepared)
    setPreview(URL.createObjectURL(prepared))
  }

  async function handleHeightCommit(nextHeight: number) {
    setLogoHeight(nextHeight)
    if (originalFileRef.current) {
      await applyLogoFile(originalFileRef.current, nextHeight)
    }
  }

  return (
    <FormItem>
      <FormLabel>Logo</FormLabel>
      {previewUrl ? (
        <div className='mb-3 flex justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-4'>
          <img
            src={previewUrl}
            alt='Company logo preview'
            className='max-w-full object-contain'
            style={{ height: logoHeight }}
          />
        </div>
      ) : null}
      <div className='mb-3 space-y-2'>
        <div className='flex items-center justify-between text-sm text-muted-foreground'>
          <span>Logo height</span>
          <span>{logoHeight}px</span>
        </div>
        <input
          type='range'
          min={MIN_COMPANY_LOGO_HEIGHT}
          max={MAX_COMPANY_LOGO_HEIGHT}
          step={4}
          value={logoHeight}
          onChange={event => {
            setLogoHeight(Number(event.currentTarget.value))
          }}
          onPointerUp={event => {
            void handleHeightCommit(Number(event.currentTarget.value))
          }}
          onKeyUp={event => {
            if (originalFileRef.current) {
              void handleHeightCommit(Number(event.currentTarget.value))
            }
          }}
          className='h-2 w-full cursor-pointer accent-zinc-900'
        />
      </div>
      <FormControl>
        <FileInput
          id='company-logo'
          label='Upload logo'
          type='image'
          onChange={file => {
            void applyLogoFile(file, logoHeight)
          }}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
