import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface ItemDocument {
  id: number
  name: string
  url: string | null
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

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

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>()

  return (
    <Accordion type='single' defaultValue='documents'>
      <AccordionItem value='documents'>
        <AccordionContent>
          <Accordion type='multiple'>
            <AccordionContent>
              <ModuleList>
                {documents
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(({ url, id, name }) => (
                    <div key={id} className='w-[118px] h-auto'>
                      <Document file={url} onClick={() => window.open(url || '')}>
                        <Page pageNumber={1} scale={0.2} />
                      </Document>
                      <p className='text-center font-bold select-none'>{name}</p>
                    </div>
                  ))}
              </ModuleList>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
