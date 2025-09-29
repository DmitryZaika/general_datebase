import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { DrawableCanvas } from '~/components/organisms/DrawableCanvas'
import { PageLayout } from '~/components/PageLayout'
import { db } from '~/db.server'
import { selectId } from '~/utils/queryHelpers'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const quoteId = Number(params.quoteId)
  if (!quoteId) {
    return redirect('/employee/quotes')
  }
  const quote = await selectId<{
    id: number
    quote_name: string
    quote_type: string
    created_date: string
    sales_rep: string
  }>(db, 'SELECT * FROM quotes WHERE id = ?', quoteId)
  if (!quote) {
    return redirect('/employee/quotes')
  }
  return { quote }
}

export default function EmployeeDraw() {
  const { quote } = useLoaderData<typeof loader>()
  return (
    <PageLayout title={`Draw ${quote.quote_name}`}>
      <div className='flex flex-col gap-4'>
        <div className='w-full flex-1'>
          <DrawableCanvas />
        </div>
      </div>
    </PageLayout>
  )
}
