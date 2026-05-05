import { FileText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { FileInput } from '~/components/molecules/FileInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { auditDisplayName } from '~/utils/customerAudit.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getEmployeeUser, type User } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'
import { fileSchema, useCustomForm } from '~/utils/useCustomForm'

interface DealDocument {
  id: number
  image_url: string
  created_at: string
  source: string
  name: string | null
}

function documentMimeType(url: string): string | null {
  const cleanUrl = url.split('?')[0].toLowerCase()
  if (cleanUrl.endsWith('.pdf')) return 'application/pdf'
  if (cleanUrl.endsWith('.txt')) return 'text/plain'
  if (cleanUrl.endsWith('.csv')) return 'text/csv'
  if (cleanUrl.endsWith('.doc')) return 'application/msword'
  if (cleanUrl.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (cleanUrl.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (cleanUrl.endsWith('.xlsx'))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return null
}

export async function action({ request, params }: ActionFunctionArgs) {
  let sessionUser: User
  try {
    sessionUser = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  await csrf.validate(request)
  const dealDocumentCreatedBy = auditDisplayName(sessionUser)

  if (!params.dealId) {
    return forceRedirectError(request.headers, 'No deal ID provided')
  }
  const dealId = parseInt(params.dealId)
  const requestClone = request.clone()
  const contentType = request.headers.get('Content-Type') || ''

  if (request.method === 'DELETE') {
    const form = await requestClone.formData()
    const id = form.get('id')

    if (id) {
      const documentId = parseInt(id.toString())
      const source = form.get('source')?.toString()
      const tableName = source === 'images' ? 'deals_images' : 'deals_documents'
      const result = await selectMany<{ image_url: string }>(
        db,
        `SELECT image_url FROM ${tableName} WHERE id = ?`,
        [documentId],
      )

      if (result.length > 0) {
        await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [documentId])
        deleteFile(result[0].image_url)

        const session = await getSession(request.headers.get('Cookie'))
        session.flash('message', toastData('Success', 'Document deleted successfully'))
        return data(
          { success: true },
          {
            headers: { 'Set-Cookie': await commitSession(session) },
          },
        )
      }
    }
    return data({ error: 'Document not found' }, { status: 404 })
  }

  if (request.method === 'POST') {
    if (!contentType.includes('multipart/form-data')) {
      posthogClient.captureException(
        new Error('Invalid content type. Expected multipart/form-data'),
      )
      return data({ error: 'Invalid content type. Expected multipart/form-data' })
    }

    const requestForName = request.clone()
    const rawForm = await requestForName.formData()
    const uploadedFile = rawForm.get('file')
    const documentNameValue =
      uploadedFile instanceof File ? uploadedFile.name.trim() : ''

    const { errors, data: parsedData } = await parseMutliForm(
      requestClone,
      fileSchema,
      'documents',
    )

    if (errors) {
      return { errors }
    }

    if (!parsedData) {
      return data({ error: 'No data received' }, { status: 400 })
    }

    try {
      await db.execute(
        `INSERT INTO deals_documents (deal_id, image_url, created_by, name) VALUES (?, ?, ?, ?)`,
        [dealId, parsedData.file, dealDocumentCreatedBy, documentNameValue || null],
      )

      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Document added successfully'))
      return data(
        { success: true },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    } catch (error) {
      posthogClient.captureException(error, 'Failed to save document to database', {
        dealId,
      })
      return data({ error: 'Failed to save document to database' }, { status: 500 })
    }
  }

  return null
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.dealId) {
    return forceRedirectError(request.headers, 'No deal ID provided')
  }

  const dealId = parseInt(params.dealId)
  const documents = await selectMany<DealDocument>(
    db,
    `SELECT id, image_url, created_at, 'documents' source, name
       FROM deals_documents
      WHERE deal_id = ?
      UNION ALL
     SELECT id, image_url, created_at, 'images' source, NULL as name
       FROM deals_images
      WHERE deal_id = ?
        AND (
          LOWER(image_url) LIKE '%.pdf'
          OR LOWER(image_url) LIKE '%.pdf?%'
          OR LOWER(image_url) LIKE '%.doc'
          OR LOWER(image_url) LIKE '%.doc?%'
          OR LOWER(image_url) LIKE '%.docx'
          OR LOWER(image_url) LIKE '%.docx?%'
          OR LOWER(image_url) LIKE '%.xls'
          OR LOWER(image_url) LIKE '%.xls?%'
          OR LOWER(image_url) LIKE '%.xlsx'
          OR LOWER(image_url) LIKE '%.xlsx?%'
          OR LOWER(image_url) LIKE '%.csv'
          OR LOWER(image_url) LIKE '%.csv?%'
          OR LOWER(image_url) LIKE '%.txt'
          OR LOWER(image_url) LIKE '%.txt?%'
        )
      ORDER BY created_at DESC`,
    [dealId, dealId],
  )

  const signedDocuments = await Promise.all(
    documents.map(async document => ({
      ...document,
      image_url: await presignIfS3Uri(
        document.image_url,
        3600,
        'inline',
        documentMimeType(document.image_url),
      ),
    })),
  )

  return { documents: signedDocuments, dealId }
}

interface DocumentToDelete {
  id: number
  source: string
}

function AddDocumentForm() {
  const navigation = useNavigation()
  const form = useCustomForm(fileSchema)
  const isSubmitting = navigation.state !== 'idle'
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
              inputName='documents'
              id='deal-document'
              type='document'
              onChange={field.onChange}
            />
          )}
        />
        <LoadingButton type='submit' className='mt-2' loading={isSubmitting}>
          Add document
        </LoadingButton>
      </div>
    </MultiPartForm>
  )
}

function documentName(url: string, id: number) {
  const cleanUrl = url.split('?')[0]
  const parts = cleanUrl.split('/')
  const name = parts[parts.length - 1]
  if (!name) return `Document ${id}`

  try {
    const decoded = decodeURIComponent(name)
    return decoded.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      '',
    )
  } catch {
    return name.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      '',
    )
  }
}

export default function DealEditDocuments() {
  const { documents } = useLoaderData<typeof loader>()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<DocumentToDelete | null>(
    null,
  )

  const handleDeleteClick = (document: DealDocument) => {
    setDocumentToDelete({ id: document.id, source: document.source })
    setShowConfirmDialog(true)
  }

  return (
    <>
      <div className='space-y-4'>
        <AddDocumentForm />
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {documents.map(document => (
            <div
              key={`${document.source}-${document.id}`}
              className='group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md'
            >
              <a
                href={document.image_url}
                target='_blank'
                rel='noreferrer'
                className='flex flex-col items-start gap-3 pr-9 text-slate-900 hover:text-blue-700'
              >
                <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700'>
                  <FileText className='h-5 w-5' />
                </span>
                <span
                  className='w-full break-words text-sm font-medium leading-5 text-slate-800'
                  title={
                    document.name?.trim() ||
                    documentName(document.image_url, document.id)
                  }
                >
                  {document.name?.trim() ||
                    documentName(document.image_url, document.id)}
                </span>
              </a>
              <Button
                type='button'
                onClick={() => handleDeleteClick(document)}
                className='absolute right-2.5 top-2.5 size-7 rounded-full bg-red-600 p-0 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100'
                title='Delete document'
              >
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Form method='delete' onSubmit={() => setShowConfirmDialog(false)}>
              <AuthenticityTokenInput />
              <input type='hidden' name='id' value={documentToDelete?.id || ''} />
              <input
                type='hidden'
                name='source'
                value={documentToDelete?.source || ''}
              />
              <Button type='submit' variant='destructive'>
                Delete
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
