import { Form, useNavigate, useNavigation } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import type { UseFormReturn } from 'react-hook-form'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInputWithVariables } from '~/components/molecules/QuillInputWithVariables'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField, FormProvider } from '~/components/ui/form'
import { useFullSubmit } from '~/hooks/useFullSubmit'

interface EmailTemplateFormData {
  template_name: string
  template_subject: string
  template_body: string
}

interface EmailTemplateFormProps {
  title: string
  form: UseFormReturn<EmailTemplateFormData>
  submitLabel?: string
  isEditMode?: boolean
}

export function EmailTemplateForm({
  title,
  form,
  submitLabel = 'Save Template',
  isEditMode = false,
}: EmailTemplateFormProps) {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const token = useAuthenticityToken()
  const fullSubmit = useFullSubmit(form)
  const hasChanges = form.formState.isDirty
  const isSubmitDisabled = isSubmitting || (isEditMode && !hasChanges)

  return (
    <Dialog open onOpenChange={open => !open && navigate('..')}>
      <DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />

            <FormField
              control={form.control}
              name='template_name'
              render={({ field }) => (
                <InputItem
                  name='Template Name'
                  placeholder='Enter template name'
                  field={field}
                />
              )}
            />

            <FormField
              control={form.control}
              name='template_subject'
              render={({ field }) => (
                <InputItem
                  name='Template Subject'
                  placeholder='Enter email subject'
                  field={field}
                />
              )}
            />

            <FormField
              control={form.control}
              name='template_body'
              render={({ field }) => (
                <QuillInputWithVariables
                  className='mb-4'
                  name='Template Body'
                  field={field}
                />
              )}
            />

            <DialogFooter className='gap-2 mt-4'>
              <Button type='button' variant='outline' onClick={() => navigate('..')}>
                Cancel
              </Button>
              <LoadingButton loading={isSubmitting} disabled={isSubmitDisabled}>
                {submitLabel}
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
