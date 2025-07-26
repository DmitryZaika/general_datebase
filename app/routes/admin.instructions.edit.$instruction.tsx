import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { QuillInput } from '~/components/molecules/QuillInput'
import { SelectInput } from '~/components/molecules/SelectItem'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { afterOptions, parentOptions } from '~/utils/instructionsHelpers'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { FormField, FormProvider } from '../components/ui/form'

const instructionSchema = z.object({
  title: z.string().min(1),
  parent_id: z.coerce.number(),
  after_id: z.coerce.number(),
  rich_text: z.string().min(1),
})

type FormData = z.infer<typeof instructionSchema>

const resolver = zodResolver(instructionSchema)

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  if (!params.instruction) {
    return forceRedirectError(request.headers, 'No Instruction id provided')
  }
  const instructionId = parseInt(params.instruction)

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  )
  if (errors) {
    return { errors, receivedValues }
  }

  await db.execute(
    `UPDATE instructions SET title = ?, parent_id = ?, after_id = ?, rich_text = ? WHERE id = ?;`,
    [
      data.title,
      data.parent_id || null,
      data.after_id || null,
      data.rich_text,
      instructionId,
    ],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Instruction updated'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

interface Instruction {
  id: number
  title: string
  parent_id: number
  after_id: number
  rich_text: string
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.instruction) {
    return forceRedirectError(request.headers, 'No instruction id provided')
  }
  const instructionId = parseInt(params.instruction)

  if (isNaN(instructionId)) {
    return forceRedirectError(request.headers, 'Invalid instruction id')
  }

  const instruction = await selectId<Instruction>(
    db,
    'SELECT title, parent_id, after_id, rich_text FROM instructions WHERE id = ?',
    instructionId,
  )

  const instructions = await selectMany<{
    title: string
    id: number
    parent_id: number
  }>(db, 'SELECT id, parent_id, title FROM instructions')

  if (!instruction) {
    return forceRedirectError(request.headers, 'Invalid supplier id')
  }
  const { title, parent_id, after_id, rich_text } = instruction
  return {
    title,
    parent_id,
    after_id,
    rich_text,
    instructions,
  }
}

export default function InstructionsEdit() {
  const navigate = useNavigate()
  const { title, parent_id, after_id, rich_text } = useLoaderData<typeof loader>()
  const { instructions } = useLoaderData<typeof loader>()
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      title,
      parent_id: parent_id || 0,
      after_id: after_id || 0,
      rich_text,
    },
  })

  const parentValues = parentOptions(instructions)
  const afterValues = afterOptions(parent_id, instructions)
  const fullSubmit = useFullSubmit(form)

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent
        className='
    !max-w-[calc(100vw*0.90)]
    !max-h-[calc(100vh*0.90)]
    overflow-y-auto
  '
      >
        <DialogHeader>
          <DialogTitle>Edit Instruction</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id='customerForm' method='post' onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <InputItem name={'Title'} placeholder={'Title'} field={field} />
              )}
            />
            <div className='flex'>
              <FormField
                control={form.control}
                name='parent_id'
                render={({ field }) => (
                  <SelectInput
                    field={field}
                    disabled={true}
                    name='Parent'
                    options={parentValues}
                  />
                )}
              />
              <FormField
                control={form.control}
                name='after_id'
                render={({ field }) => (
                  <SelectInput
                    className='ml-2'
                    field={field}
                    name='After'
                    disabled={true}
                    options={afterValues}
                  />
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='rich_text'
              render={({ field }) => (
                <QuillInput className='min-h-28' name='Text' field={field} />
              )}
            />

            <DialogFooter>
              <Button className='mt-6' type='submit'>
                Save changes
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
