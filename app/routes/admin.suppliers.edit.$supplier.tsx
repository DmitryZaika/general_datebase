import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'

import { FileInput } from '~/components/molecules/FileInput'
import { InputItem } from '~/components/molecules/InputItem'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'
import { useCustomOptionalForm } from '~/utils/useCustomForm'
import { FormField, FormProvider } from '../components/ui/form'

const supplierschema = z.object({
  website: z.url(),
  supplier_name: z.string().min(1),
  manager: z.string().optional(),
  phone: z.union([z.coerce.string().min(10), z.literal('')]),
  email: z.union([z.email().optional(), z.literal('')]),
  notes: z.string().optional(),
})

const fileSchema = z.object({
  name: z.string().min(1),
})

const supplierInfoResolver = zodResolver(supplierschema)

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.supplier) {
    return forceRedirectError(request.headers, 'No supplier id provided')
  }
  const supplierId = parseInt(params.supplier, 10)

  if (request.method === 'DELETE') {
    try {
      await csrf.validate(request)
    } catch {
      return { error: 'Invalid CSRF token' }
    }
    const form = await request.formData()
    const id = form.get('id')
    if (!id) {
      return forceRedirectError(request.headers, 'No id provided')
    }
    const fileId = parseInt(id.toString(), 10)
    const record = await selectId<{ url: string | null }>(
      db,
      'SELECT url FROM supplier_files WHERE id = ?',
      fileId,
    )
    await db.execute('DELETE FROM supplier_files WHERE id = ?', [fileId])
    const session = await getSession(request.headers.get('Cookie'))
    if (record?.url) {
      deleteFile(record.url)
    }
    session.flash('message', toastData('Success', 'File Deleted'))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  }

  const contentType = request.headers.get('Content-Type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    try {
      await csrf.validate(request)
    } catch {
      return { error: 'Invalid CSRF token' }
    }

    const { errors, data: formData } = await parseMutliForm(
      request,
      fileSchema,
      'files',
    )
    if (errors || !formData) {
      return { errors }
    }

    await db.execute(
      'INSERT INTO supplier_files (name, supplier_id, url) VALUES (?, ?, ?)',
      [formData.name, supplierId, formData.file ?? ''],
    )
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'File Added'))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  }

  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const { errors, data: supplierData } = await getValidatedFormData(
    request,
    supplierInfoResolver,
  )
  if (errors) {
    return { errors }
  }

  await db.execute(
    `UPDATE suppliers SET website = ?, supplier_name = ?, manager = ?, phone = ?, email = ?, notes = ? WHERE id = ?`,
    [
      supplierData.website,
      supplierData.supplier_name,
      supplierData.manager || null,
      supplierData.phone,
      supplierData.email || null,
      supplierData.notes || null,
      supplierId,
    ],
  )

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', 'Supplier updated'))
  return redirect('/admin/suppliers', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

interface Supplier {
  website: string
  supplier_name: string
  manager: string
  email: string
  phone: string
  notes: string
}

interface SupplierFile {
  id: number
  name: string
  url: string
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.supplier) {
    return forceRedirectError(request.headers, 'No supplier id provided')
  }

  const supplierId = parseInt(params.supplier, 10)

  if (Number.isNaN(supplierId)) {
    return forceRedirectError(request.headers, 'Invalid supplier id')
  }

  const supplier = await selectId<Supplier>(
    db,
    'select website, supplier_name, manager, phone, email, notes from suppliers WHERE id = ?',
    supplierId,
  )

  if (!supplier) {
    return forceRedirectError(request.headers, 'Invalid supplier id')
  }

  const files = await selectMany<SupplierFile>(
    db,
    'SELECT id, name, url FROM supplier_files WHERE supplier_id = ?',
    [supplierId],
  )

  return { supplier, files }
}

function InformationForm({ supplier }: { supplier: Supplier }) {
  const form = useForm({
    resolver: supplierInfoResolver,
    defaultValues: {
      website: supplier.website || '',
      supplier_name: supplier.supplier_name || '',
      manager: supplier.manager || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      notes: supplier.notes || '',
    },
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <FormProvider {...form}>
      <Form id='customerForm' method='post' onSubmit={fullSubmit}>
        <FormField
          control={form.control}
          name='website'
          render={({ field }) => (
            <InputItem name={'Website'} placeholder={'Website'} field={field} />
          )}
        />
        <FormField
          control={form.control}
          name='supplier_name'
          render={({ field }) => (
            <InputItem
              name={'Supplier Name'}
              placeholder={'Name of the supplier'}
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name='manager'
          render={({ field }) => (
            <InputItem
              name={'Manager'}
              placeholder={'Name of the manager'}
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <InputItem
              name={'Phone Number'}
              placeholder={'Phone Number'}
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <InputItem name={'Email'} placeholder={'Email'} field={field} />
          )}
        />
        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <InputItem name={'Notes'} placeholder={'Notes'} field={field} />
          )}
        />
        <DialogFooter>
          <Button type='submit'>Save changes</Button>
        </DialogFooter>
      </Form>
    </FormProvider>
  )
}

function AddFile() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'
  const form = useCustomOptionalForm(fileSchema, {
    defaultValues: {
      name: '',
      file: undefined,
    },
  })
  useEffect(() => {
    if (navigation.state === 'idle') {
      form.reset({
        name: '',
        file: undefined,
      })
    }
  }, [navigation.state, form])
  return (
    <MultiPartForm form={form} className='mb-5'>
      <AuthenticityTokenInput />
      <div className='flex gap-2 [&>*:first-child]:w-[70%] [&>*:last-child]:w-[30%]'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <InputItem
              name='Name'
              className='-mb-3'
              placeholder='File name'
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <FileInput
              label='Document'
              inputName='documents'
              id='document'
              type='all'
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <Button type='submit' disabled={isSubmitting}>
        {isSubmitting ? 'Uploading...' : 'Add File'}
      </Button>
    </MultiPartForm>
  )
}

function FilesContent({ files }: { files: SupplierFile[] }) {
  const [_, setSelectedFile] = useState<string | null>(null)
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  return (
    <>
      <AddFile />
      <div className='flex flex-col gap-2'>
        {files.map(file => (
          <div key={file.id} className='flex gap-1 justify-between items-center'>
            <div className='size-9 cursor-pointer flex items-center justify-center bg-gray-100'>
              {file.url && (
                <img
                  src={file.url}
                  alt={file.name}
                  className='size-9 object-cover'
                  onClick={() => setSelectedFile(file.url)}
                />
              )}
            </div>
            <div className='p-1.5 border w-full border-gray-300'>
              <p className='w-full'>{file.name}</p>
              <Form method='delete'>
                <AuthenticityTokenInput />
                <input type='hidden' name='id' value={file.id} />
                <Button type='submit' disabled={isSubmitting}>
                  <X />
                </Button>
              </Form>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function SuppliersEdit() {
  const navigate = useNavigate()
  const { supplier, files } = useLoaderData<typeof loader>()
  const [activeTab, setActiveTab] = useState('information')

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('/admin/suppliers')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value='information'>General</TabsTrigger>
            <TabsTrigger value='files'>Files</TabsTrigger>
          </TabsList>
          <TabsContent value='information'>
            <InformationForm supplier={supplier} />
          </TabsContent>
          <TabsContent value='files'>
            <FilesContent files={files} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
