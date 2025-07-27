import type mysql from 'mysql2/promise'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { FileInput } from '~/components/molecules/FileInput'
import { InputItem } from '~/components/molecules/InputItem'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { SelectInput } from '~/components/molecules/SelectItem'
import { SwitchItem } from '~/components/molecules/SwitchItem'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { faucetSchema } from '~/schemas/faucets'
import { commitSession, getSession } from '~/sessions'
import { FAUCET_TYPES } from '~/utils/constants'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'
import { useCustomForm } from '~/utils/useCustomForm'
import { FormField } from '../components/ui/form'

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

  const { errors, data } = await parseMutliForm(request, faucetSchema, 'faucets')
  if (errors || !data) {
    return { errors }
  }
  const user = await getAdminUser(request)
  try {
    await db.execute<mysql.ResultSetHeader>(
      `INSERT INTO faucet_type (name, type, url, company_id, is_display, is_deleted, supplier_id, retail_price, cost) 
         VALUES (?, ?, ?, ?, ?, false, ?, ?, ?);`,
      [
        data.name,
        data.type,
        data.file,
        user.company_id,
        data.is_display,
        data.supplier_id,
        data.retail_price,
        data.cost,
      ],
    )
  } catch {
    const faucetId = parseInt(params.faucet ?? '0', 10)
    if (!faucetId) {
      return new Response(JSON.stringify({ error: 'Invalid or missing faucet ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Faucet added'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    const suppliers = await selectMany<{
      id: number
      supplier_name: string
    }>(db, 'SELECT id, supplier_name FROM suppliers WHERE company_id = ?', [
      user.company_id,
    ])
    return { suppliers }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export default function FaucetsAdd() {
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const { suppliers } = useLoaderData<typeof loader>()

  const form = useCustomForm(faucetSchema, {
    defaultValues: {
      is_display: true,
    },
  })

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate('..')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px] overflow-y-auto max-h-[95vh]'>
        <DialogHeader>
          <DialogTitle>Add Faucet</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <InputItem
                inputAutoFocus={true}
                name={'Name'}
                placeholder={'Name of the faucet'}
                field={field}
              />
            )}
          />
          <div className='flex gap-2'>
            {' '}
            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder='Type of the Faucet'
                  name='Type'
                  options={FAUCET_TYPES.map(item => ({
                    key: item,
                    value: item.charAt(0).toUpperCase() + item.slice(1),
                  }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name='file'
              render={({ field }) => (
                <FileInput
                  inputName='faucets'
                  type='image'
                  id='image'
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className='flex justify-between gap-2'>
            <FormField
              defaultValue={true}
              control={form.control}
              name='is_display'
              render={({ field }) => <SwitchItem field={field} name='Display' />}
            />
            <FormField
              control={form.control}
              name='supplier_id'
              render={({ field }) => (
                <SelectInput
                  options={suppliers.map(item => ({
                    key: item.id.toString(),
                    value: item.supplier_name,
                  }))}
                  name={'Supplier'}
                  placeholder={'Supplier of the faucet'}
                  field={field}
                />
              )}
            />
          </div>
          <div className='flex gap-2'>
            <FormField
              control={form.control}
              name='retail_price'
              render={({ field }) => (
                <InputItem
                  name={'Retail Price'}
                  placeholder={'Retail price of the faucet'}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name='cost'
              render={({ field }) => (
                <InputItem
                  name={'Cost'}
                  placeholder={'Cost of the faucet'}
                  field={field}
                />
              )}
            />
          </div>

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Faucet</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  )
}
