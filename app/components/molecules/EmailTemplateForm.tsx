import type { UseFormReturn } from 'react-hook-form'
import { Form, useLocation, useNavigate, useNavigation } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInput } from '~/components/molecules/QuillInput'
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
}

export function EmailTemplateForm({
  title,
  form,
  submitLabel = 'Save Template',
}: EmailTemplateFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isSubmitting = useNavigation().state !== 'idle'
  const token = useAuthenticityToken()
  const fullSubmit = useFullSubmit(form)

  return (
    <Dialog open onOpenChange={open => !open && navigate(`..${location.search}`)}>
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
                <QuillInput className='mb-4' name='Template Body' field={field} />
              )}
            />

            <p className='p-3 mb-4 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md'>
              To create dynamic placeholders, use double curly braces like{' '}
              <span className='font-semibold'>{'{{Client Name}}'}</span>,{' '}
              <span className='font-semibold'>{'{{Company}}'}</span>,{' '}
              <span className='font-semibold'>{'{{Date}}'}</span>, etc.
            </p>

            <DialogFooter className='gap-2 mt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => navigate(`..${location.search}`)}
              >
                Cancel
              </Button>
              <LoadingButton loading={isSubmitting}>{submitLabel}</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
