import type { UseFormReturn } from 'react-hook-form'
import { useLocation, useNavigate, useNavigation } from 'react-router'
import {
  EmailAttachmentMenuButton,
  EmailAttachmentsDialogs,
  EmailAttachmentsPreviews,
  EmailAttachmentsProvider,
  useEmailAttachmentChanges,
} from '~/components/molecules/EmailAttachmentsField'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { QuillInputWithVariables } from '~/components/molecules/QuillInputWithVariables'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'
import type { EmailTemplateAttachment } from '~/utils/emailTemplates'

export interface EmailTemplateFormData {
  template_name: string
  template_subject: string
  template_body: string
  attachments: File[]
  removed_attachment_ids: number[]
}

interface EmailTemplateFormProps {
  title: string
  form: UseFormReturn<EmailTemplateFormData>
  companyId: number
  existingAttachments?: EmailTemplateAttachment[]
  submitLabel?: string
  isEditMode?: boolean
}

function EmailTemplateFormFields({
  form,
  submitLabel,
  isEditMode,
}: Pick<EmailTemplateFormProps, 'form' | 'submitLabel' | 'isEditMode'>) {
  const navigate = useNavigate()
  const location = useLocation()
  const isSubmitting = useNavigation().state !== 'idle'
  const hasChanges = form.formState.isDirty
  const hasAttachmentChanges = useEmailAttachmentChanges()
  const isSubmitDisabled =
    isSubmitting || (isEditMode && !hasChanges && !hasAttachmentChanges)

  return (
    <>
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

      <EmailAttachmentsPreviews />

      <DialogFooter className='mt-4 sm:justify-end'>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => navigate(`..${location.search}`)}
          >
            Cancel
          </Button>
          <EmailAttachmentMenuButton />
          <LoadingButton loading={isSubmitting} disabled={isSubmitDisabled}>
            {submitLabel ?? 'Save Template'}
          </LoadingButton>
        </div>
      </DialogFooter>

      <EmailAttachmentsDialogs />
    </>
  )
}

export function EmailTemplateForm({
  title,
  form,
  companyId,
  existingAttachments = [],
  submitLabel = 'Save Template',
  isEditMode = false,
}: EmailTemplateFormProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Dialog open onOpenChange={open => !open && navigate(`..${location.search}`)}>
      <DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <MultiPartForm form={form}>
          <EmailAttachmentsProvider
            companyId={companyId}
            existingAttachments={existingAttachments}
          >
            <EmailTemplateFormFields
              form={form}
              submitLabel={submitLabel}
              isEditMode={isEditMode}
            />
          </EmailAttachmentsProvider>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  )
}
