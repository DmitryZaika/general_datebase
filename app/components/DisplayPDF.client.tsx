import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Document, Page, pdfjs } from 'react-pdf'
import ModuleList from '~/components/ModuleList'

interface ItemDocument {
  id: number
  name: string
  url: string | null
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function DocumentRenderer({ documents }: { documents: ItemDocument[] }) {
  return (
    <ModuleList>
      {documents
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ url, id, name }) => (
          <div key={id} className='w-29.5 h-auto'>
            <Document file={url} onClick={() => window.open(url || '')}>
              <Page pageNumber={1} scale={0.2} />
            </Document>
            <p className='text-center font-bold select-none'>{name}</p>
          </div>
        ))}
    </ModuleList>
  )
}
