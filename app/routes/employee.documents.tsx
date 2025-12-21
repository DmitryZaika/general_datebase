import { lazy, Suspense } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { ClientOnly } from 'remix-utils/client-only'
import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

const DocumentRenderer = lazy(() => import('~/components/DisplayPDF.client'))

interface ItemDocument {
  id: number
  name: string
  url: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getEmployeeUser(request)
  const documents = await selectMany<ItemDocument>(
    db,
    'SELECT id, name, url FROM documents WHERE company_id = ?',
    [user.company_id],
  )
  return { documents }
}

function Fallback() {
  return <div>Loading...</div>
}

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>()

  return (
    <Accordion type='single' defaultValue='documents'>
      <AccordionItem value='documents'>
        <AccordionContent>
          <Accordion type='multiple'>
            <AccordionContent>
              <ClientOnly fallback={<Fallback />}>
                {() => (
                  <Suspense fallback={<Fallback />}>
                    <DocumentRenderer documents={documents} />
                  </Suspense>
                )}
              </ClientOnly>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
