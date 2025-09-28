import { LoaderFunctionArgs, redirect, useLoaderData } from "react-router"
import { db } from "~/db.server"
import { selectId } from "~/utils/queryHelpers"
import { getEmployeeUser } from "~/utils/session.server"

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getEmployeeUser(request)
  if (!params.quoteId) {
    return redirect('/employee/quotes')
  }
  const quoteId = parseInt(params.quoteId, 10)
  if (Number.isNaN(quoteId)) {
    return redirect('/employee/quotes')
  }
  const quote = await selectId<{
    id: number
    customer_id: number
    quote_name: string
    quote_type: string
    created_date: string
    sales_rep: string
  }>(
    db,
    'SELECT * FROM quotes WHERE id = ?',
    quoteId,
  )
  if (!quote) {
    return redirect('/employee/quotes')
  }
  return { quote }
}

export default function EmployeeQuotesEdit() {
    const { quote } = useLoaderData<typeof loader>()
  return (
    <div>
      <h1>Edit Quote {quote.quote_name}</h1>
    </div>
  )
}