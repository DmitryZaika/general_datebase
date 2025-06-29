import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from 'react-router'
import {
  useNavigate,
  useLoaderData,
  useNavigation,
  Outlet,
  useRouteError,
} from 'react-router'
import { FormField } from '../components/ui/form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import type mysql from 'mysql2/promise'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { FileInput } from '~/components/molecules/FileInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { useCustomOptionalForm } from '~/utils/useCustomForm'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { csrf } from '~/utils/csrf.server'
import { SelectInput } from '~/components/molecules/SelectItem'
import { SwitchItem } from '~/components/molecules/SwitchItem'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { sinkSchema } from '~/schemas/sinks'

type SinkData = {
  name: string
  type: string
  url: string
  is_display: boolean
  supplier_id: string
  length: string
  width: string
  cost: number | null
  retail_price: number | null
  amount: number
}

type SupplierData = {
  id: number
  supplier_name: string
}

type LoaderData = {
  sink: SinkData
  suppliers: SupplierData[]
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getAdminUser(request).catch(err => {
    return redirect(`/login?error=${err}`)
  })
  await csrf.validate(request).catch(() => {
    return { error: 'Invalid CSRF token' }
  })
  if (!params.sink) {
    return forceRedirectError(request.headers, 'No sink id provided')
  }
  const sinkId = parseInt(params.sink, 10)
  const { errors, data } = await parseMutliForm(request, sinkSchema, 'sinks')
  if (errors || !data) {
    return { errors }
  }
  const newFile = data.file && data.file !== 'undefined'

  try {
    let oldUrl = null
    if (newFile) {
      const [oldFileRows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT url FROM sink_type WHERE id = ?`,
        [sinkId],
      )
      oldUrl = oldFileRows[0]?.url
    }

    try {
      if (newFile) {
        await db.execute(
          `UPDATE sink_type
            SET name = ?, type = ?, url = ?, is_display = ?, supplier_id = ?, length = ?, width = ?, cost = ?, retail_price = ?
           WHERE id = ?`,
          [
            data.name,
            data.type,
            data.file,
            data.is_display,
            !data.supplier_id || data.supplier_id === 0 ? null : data.supplier_id,
            data.length,
            data.width,
            data.cost,
            data.retail_price,
            sinkId,
          ],
        )
      } else {
        await db.execute(
          `UPDATE sink_type
           SET name = ?, type = ?, is_display = ?, supplier_id = ?, length = ?, width = ?, cost = ?, retail_price = ?
           WHERE id = ?`,
          [
            data.name,
            data.type,
            data.is_display,
            !data.supplier_id || data.supplier_id === 0 ? null : data.supplier_id,
            data.length,
            data.width,
            data.cost,
            data.retail_price,
            sinkId,
          ],
        )
      }

      const [countRows] = await db.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM sinks WHERE sink_type_id = ? AND is_deleted = 0`,
        [sinkId],
      )
      const currentAmount = countRows[0]?.count || 0
      const newAmount = data.amount || 0

      if (newAmount > currentAmount) {
        const toAdd = newAmount - currentAmount
        for (let i = 0; i < toAdd; i++) {
          await db.execute(
            `INSERT INTO sinks (sink_type_id, is_deleted) VALUES (?, 0)`,
            [sinkId],
          )
        }
      } else if (newAmount < currentAmount) {
        const toDelete = currentAmount - newAmount

        const [allUnusedRows] = await db.execute<mysql.RowDataPacket[]>(
          `SELECT id FROM sinks 
           WHERE sink_type_id = ? AND sale_id IS NULL AND is_deleted = 0`,
          [sinkId],
        )

        const rowsToUpdate = allUnusedRows.slice(0, toDelete)

        for (const row of rowsToUpdate) {
          await db.execute(`UPDATE sinks SET is_deleted = 1 WHERE id = ?`, [row.id])
        }
      }

      if (newFile && oldUrl) {
        await deleteFile(oldUrl)
      }
    } catch (error) {
      console.error('Error updating sink: ', error)
      throw error
    }
  } catch (error) {
    console.error('Error updating sink: ', error)
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Sink Edited'))
  return redirect('..', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await getAdminUser(request).catch(err => {
    return redirect(`/login?error=${err}`)
  })

  if (!user || user instanceof Response) {
    return redirect('/admin')
  }

  if (!params.sink) {
    return forceRedirectError(request.headers, 'No sink id provided')
  }
  const sinkId = parseInt(params.sink, 10)

  const sink = await selectId<{
    name: string
    type: string
    url: string
    is_display: boolean
    supplier_id: string
    length: string
    width: string
    cost: number | null
    retail_price: number | null
  }>(
    db,
    'SELECT name, type, url, is_display, supplier_id, length, width, cost, retail_price FROM sink_type WHERE id = ?',
    sinkId,
  )

  if (!sink) {
    return forceRedirectError(request.headers, 'No sink found')
  }

  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM sinks WHERE sink_type_id = ? AND is_deleted = 0`,
    [sinkId],
  )

  const sinkWithAmount = {
    ...sink,
    amount: rows[0]?.count || 0,
  }

  const suppliers = await selectMany<{
    id: number
    supplier_name: string
  }>(db, 'SELECT id, supplier_name FROM suppliers WHERE company_id = ?', [
    user.company_id,
  ])
  return {
    sink: sinkWithAmount,
    suppliers,
  }
}

function SinkInformation({
  sinkData,
  suppliers,
  refresh,
}: {
  sinkData: SinkData
  suppliers: SupplierData[]
  refresh: () => void
}) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'
  const {
    name,
    type,
    url,
    is_display,
    supplier_id,
    length,
    width,
    amount,
    cost,
    retail_price,
  } = sinkData
  const defaultValues = {
    name,
    type,
    url: '',
    is_display,
    supplier_id,
    length,
    width,
    amount,
    cost,
    retail_price,
  }
  const form = useCustomOptionalForm(sinkSchema, defaultValues)

  return (
    <MultiPartForm form={form}>
      <FormField
        control={form.control}
        name='name'
        render={({ field }) => (
          <InputItem name='Name' placeholder='Sink name' field={field} />
        )}
      />
      <div className='flex gap-2'>
        <FormField
          control={form.control}
          name='type'
          render={({ field }) => (
            <SelectInput
              name='Type'
              placeholder='Sink Type'
              field={field}
              options={[
                'Stainless 18 gauge',
                'Stainless 16 gauge',
                'Granite Composite',
                'Ceramic',
                'Farm House',
              ]}
            />
          )}
        />
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <FileInput
              inputName='sinks'
              id='image'
              type='image'
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className='flex justify-between gap-2'>
        <FormField
          control={form.control}
          name='is_display'
          render={({ field }) => <SwitchItem field={field} name='Display' />}
        />
        <FormField
          control={form.control}
          name='supplier_id'
          render={({ field }) => (
            <SelectInput
              name='Supplier'
              placeholder='Supplier'
              field={field}
              options={suppliers.map(item => ({
                key: item.id.toString(),
                value: item.supplier_name,
              }))}
            />
          )}
        />
      </div>
      {url ? <img src={url} alt={name} className='w-48 mt-4 mx-auto' /> : null}
      <div className='flex gap-2'>
        <FormField
          control={form.control}
          name='length'
          render={({ field }) => (
            <InputItem name='Length' placeholder='Sink length' field={field} />
          )}
        />
        <FormField
          control={form.control}
          name='width'
          render={({ field }) => (
            <InputItem name='Width' placeholder='Sink width' field={field} />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name='amount'
        render={({ field }) => (
          <InputItem name='Amount' placeholder='Sink Amount' field={field} />
        )}
      />
      <div className='flex gap-2'>
        <FormField
          control={form.control}
          name='retail_price'
          render={({ field }) => (
            <InputItem
              name='Retail Price'
              placeholder='Sink Retail Price'
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name='cost'
          render={({ field }) => (
            <InputItem name='Cost' placeholder='Sink Cost' field={field} />
          )}
        />
      </div>

      <DialogFooter className='mt-4'>
        <LoadingButton loading={isSubmitting}>Save Changes</LoadingButton>
      </DialogFooter>
    </MultiPartForm>
  )
}
export default function SinksEdit() {
  const loaderData = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  if (
    !loaderData ||
    loaderData instanceof Response ||
    !('sink' in loaderData) ||
    !('suppliers' in loaderData)
  ) {
    return null
  }

  const { sink, suppliers } = loaderData as LoaderData

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }
  const refresh = () => {
    navigate('.', { replace: true })
  }
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px] overflow-auto max-h-[95vh]'>
        <DialogHeader>
          <DialogTitle>Edit Sink</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue='information'
          onValueChange={value => {
            if (value === 'images') navigate('images')
          }}
        >
          <TabsList>
            <TabsTrigger value='information'>General</TabsTrigger>
            <TabsTrigger value='images'>Images</TabsTrigger>
          </TabsList>
          <TabsContent value='information'>
            <SinkInformation sinkData={sink} suppliers={suppliers} refresh={refresh} />
          </TabsContent>
          <TabsContent value='images'>
            <Outlet />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
