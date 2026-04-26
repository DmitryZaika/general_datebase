import { zodResolver } from '@hookform/resolvers/zod'
import type { ResultSetHeader } from 'mysql2'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { QuillInput } from '~/components/molecules/QuillInput'
import { SelectInput } from '~/components/molecules/SelectItem'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import {
  afterOptions,
  type InstructionsBasic,
  parentOptions,
} from '~/utils/instructionsHelpers'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'
import { FormField, FormProvider } from '../components/ui/form'

const instructionschema = z.object({
  title: z.string().min(1),
  parent_id: z.coerce.number(),
  after_id: z.coerce.number(),
  rich_text: z.string(),
  public: z.coerce.number(),
})

const resolver = zodResolver(instructionschema)

export async function action({ request }: ActionFunctionArgs) {
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

  const { errors, data } = await getValidatedFormData(request, resolver)
  if (errors) {
    return { errors }
  }

  let insertId: null | number = null
  const parentId = data.parent_id || null
  const afterId = data.after_id || null
  const user = await getAdminUser(request)
  const isGeneral = data.public === 2
  const companyId = isGeneral ? 0 : user.company_id
  const publicVal = data.public === 1 ? 1 : 0

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO instructions (title, parent_id, after_id, rich_text, company_id, public)
       VALUES (?, ?, ?, ?, ?, ?)`,
    [data.title, parentId, afterId, data.rich_text, companyId, publicVal],
  )
  insertId = result.insertId

  const query = `UPDATE instructions
      SET after_id = ?
      WHERE
        (after_id = ? OR (after_id IS NULL AND ? IS NULL))
        AND id != ?
        AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
        AND company_id = ?
        AND public = ?;`
  await db.execute(query, [
    insertId,
    data.after_id,
    data.after_id,
    insertId,
    parentId,
    parentId,
    companyId,
    publicVal,
  ])

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Instruction added'))

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const redirectUrl = type ? `..?type=${type}` : '..'

  return redirect(redirectUrl, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getAdminUser(request)
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const isPublic = type === 'customer' ? 1 : 0
  const companyId = type === 'general' ? 0 : user.company_id

  const instructions = await selectMany<InstructionsBasic>(
    db,
    'SELECT id, parent_id, title FROM instructions WHERE company_id = ? AND public = ?',
    [companyId, isPublic],
  )
  if (!instructions) {
    return { instructions: [], type }
  }
  return { instructions, type }
}

function cleanId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  return parseInt(value)
}

export default function InstructionsAdd() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const token = useAuthenticityToken()
  const { instructions, type } = useLoaderData<typeof loader>()

  let defaultPublic = 0
  if (type === 'customer') {
    defaultPublic = 1
  } else if (type === 'general') {
    defaultPublic = 2
  }

  const form = useForm({
    resolver,
    defaultValues: {
      title: '',
      rich_text: '',
      after_id: '0' as unknown as number,
      parent_id: '0' as unknown as number,
      public: defaultPublic,
    },
  })

  const parent_id = cleanId(form.watch('parent_id') as unknown as string)
  const parentValues = parentOptions(instructions)
  const afterValues = afterOptions(parent_id, instructions)

  const fullSubmit = useFullSubmit(form)

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(type ? `..?type=${type}` : '..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent
        className='
    !max-w-[calc(100vw*0.90)]
    !max-h-[calc(100vh*0.90)]
    h-[calc(100vh*.90)]
    overflow-y-auto
  '
      >
        <DialogHeader>
          <DialogTitle>Add instruction</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form id='customerForm' method='post' onSubmit={fullSubmit}>
            <input type='hidden' name='csrf' value={token} />
            <input type='hidden' name='public' value={form.watch('public')} />
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <InputItem
                  name='Title'
                  placeholder='Name of the instruction'
                  field={field}
                />
              )}
            />
            <div className='flex'>
              <FormField
                control={form.control}
                name='parent_id'
                render={({ field }) => (
                  <SelectInput
                    field={field}
                    disabled={parentValues.length === 0}
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
                    field={field}
                    name='After'
                    className='ml-2'
                    disabled={afterValues.length === 0}
                    options={afterValues}
                  />
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='rich_text'
              render={({ field }) => (
                <QuillInput className='mb-24' name='Text' field={field} />
              )}
            />

            <DialogFooter className='sticky bottom-0 p-0'>
              <LoadingButton loading={isSubmitting}>Add Instruction</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
