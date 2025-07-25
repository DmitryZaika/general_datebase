import { type ActionFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { getStripe } from '~/utils/getStripe'
import { selectMany } from '~/utils/queryHelpers'
import { toastData } from '~/utils/toastHelpers'

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const saleId = formData.get('saleId')
  const amount = formData.get('amount')
  const viewId = formData.get('viewId')

  if (!saleId || !amount || !viewId) {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Error', 'Missing required fields', 'destructive'),
    )
    return redirect(`/customers/${viewId}`, {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  try {
    // Get sale details
    const sale = await selectMany<{
      id: number
      price: number
      customer_name: string
      customer_email: string
    }>(
      db,
      `SELECT 
                s.id,
                s.price,
                c.name as customer_name,
                c.email as customer_email
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.id = ?`,
      [Number(saleId)],
    )

    if (!sale || !sale[0]) {
      throw new Error('Sale not found')
    }

    const { customer_name, customer_email, price } = sale[0]

    // Create Stripe checkout session
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Sale #${saleId}`,
              description: `Payment for ${customer_name}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/customers/${viewId}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/customers/${viewId}?payment_status=cancelled`,
      customer_email: customer_email || undefined,
      payment_intent_data: {
        metadata: {
          saleId: saleId.toString(),
          viewId: viewId.toString(),
        },
      },
    })

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return redirect(session.url)
  } catch {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Error', 'Failed to create checkout session', 'destructive'),
    )
    return redirect(`/customers/${viewId}`, {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }
}
