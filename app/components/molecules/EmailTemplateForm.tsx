import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Form, useLocation, useNavigate, useNavigation } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { Collapsible } from '~/components/Collapsible'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInputWithVariables } from '~/components/molecules/QuillInputWithVariables'
import { SwitchItem } from '~/components/molecules/SwitchItem'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider,
} from '~/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import type { EmailTemplateFormData, LeadGroup } from '~/schemas/emailTemplates'

interface EmailTemplateFormProps {
  title: string
  form: UseFormReturn<EmailTemplateFormData>
  groups: LeadGroup[]
  submitLabel?: string
  isEditMode?: boolean
}

export function EmailTemplateForm({
  title,
  form,
  groups,
  submitLabel = 'Save Template',
  isEditMode = false,
}: EmailTemplateFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isSubmitting = useNavigation().state !== 'idle'
  const token = useAuthenticityToken()
  const fullSubmit = useFullSubmit(form)
  const hasChanges = form.formState.isDirty
  const isSubmitDisabled = isSubmitting || (isEditMode && !hasChanges)

  const defaultLeadGroupId = form.getValues('lead_group_id')
  const [isAutoSendOpen, setIsAutoSendOpen] = useState(Boolean(defaultLeadGroupId))

  return (
    <Dialog open onOpenChange={open => !open && navigate(`..${location.search}`)}>
      <DialogContent className='sm:max-w-[800px] max-h-[90vh] flex flex-col p-0'>
        <DialogHeader className='px-6 pt-6 pb-4'>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form
            method='post'
            onSubmit={fullSubmit}
            className='flex flex-col min-h-0 flex-1'
          >
            <input type='hidden' name='csrf' value={token} />

            <div className='flex-1 overflow-y-auto px-6'>
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

              <Collapsible
                isOpen={isAutoSendOpen}
                className=''
                maxHeight='max-h-[600px]'
              >
                <div className='space-y-4 p-4 border rounded-lg bg-muted/50 mb-4'>
                  <FormField
                    control={form.control}
                    name='lead_group_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Group</FormLabel>
                        <Select
                          onValueChange={val =>
                            field.onChange(val === '__none__' ? '' : val)
                          }
                          value={field.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a group...' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='__none__'>None</SelectItem>
                            {groups.map(group => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='hour_delay'
                    render={({ field }) => (
                      <InputItem
                        name='Delay (hours)'
                        placeholder='Hours to wait before sending'
                        type='number'
                        field={field}
                      />
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='show_template'
                    render={({ field }) => (
                      <SwitchItem name='Show in Template List' field={field} />
                    )}
                  />
                </div>
              </Collapsible>
            </div>

            <DialogFooter className='gap-2 px-6 py-4 border-t'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsAutoSendOpen(prev => !prev)}
              >
                {isAutoSendOpen ? 'Hide Auto Sending' : 'Set Auto Sending'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => navigate(`..${location.search}`)}
              >
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
