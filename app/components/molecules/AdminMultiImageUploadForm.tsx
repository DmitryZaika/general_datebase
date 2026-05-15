import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigation } from 'react-router'

import { FileInput } from '~/components/molecules/FileInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import type { ButtonProps } from '~/components/ui/button'
import { FormField } from '~/components/ui/form'
import { type MultiImageFormValues, multiFileSchema } from '~/utils/useCustomForm'

type AdminMultiImageUploadFormProps = {
  fileInputId: string
  submitLabel?: string
  submitButtonClassName?: string
  variant?: ButtonProps['variant']
}

export function AdminMultiImageUploadForm({
  fileInputId,
  submitLabel = 'Add images',
  submitButtonClassName,
  variant,
}: AdminMultiImageUploadFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const form = useForm<MultiImageFormValues>({
    resolver: zodResolver(multiFileSchema),
  })
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    if (navigation.state === 'idle') {
      form.reset()
      setInputKey(k => k + 1)
    }
  }, [navigation.state, form])

  return (
    <MultiPartForm form={form}>
      <div className='flex items-center space-x-4'>
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <FileInput
              key={inputKey}
              inputName='images'
              id={fileInputId}
              type='image'
              multiple
              selectedFiles={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <LoadingButton
          type='submit'
          variant={variant}
          className={submitButtonClassName}
          loading={isSubmitting}
        >
          {submitLabel}
        </LoadingButton>
      </div>
    </MultiPartForm>
  )
}
