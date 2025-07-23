import type { ColumnDef } from '@tanstack/react-table'
import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  redirect,
} from 'react-router'
import { Outlet, useLoaderData, Form } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { SortableHeader } from '~/components/molecules/DataTable/SortableHeader'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'
import { getSession, commitSession } from '~/sessions'
import { Check, X } from 'lucide-react'

interface PayrollItem {
  id: number
  sale_id: number
  seller_id: number
  seller_name: string
  customer_name: string
  sale_date: string
  sale_total: number
  sale_status: string
  paid_date: string | null
  sales_payroll: number | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const companyId = user.company_id
    const url = new URL(request.url)

    const paymentStatus = url.searchParams.get('paymentStatus') || 'all'

    let query = `
      SELECT 
        sales.id as sale_id, 
        users.id as seller_id,
        users.name as seller_name,
        customers.name as customer_name,
        sales.sale_date,
        sales.price as sale_total,
        CASE
          WHEN sales.cancelled_date IS NOT NULL THEN 'Cancelled'
          WHEN sales.installed_date IS NOT NULL THEN 'Installed'
          ELSE 'Pending'
        END as sale_status,
        sales.paid_date,
        sales.sales_payroll
      FROM 
        sales
      JOIN 
        customers ON sales.customer_id = customers.id
      JOIN 
        users ON sales.seller_id = users.id
      WHERE
        sales.company_id = ? AND
        sales.paid_date IS NOT NULL
    `

    const queryParams: any[] = [companyId]

    if (paymentStatus === 'paid') {
      query += ' AND sales.sales_payroll IS NOT NULL'
    } else if (paymentStatus === 'unpaid') {
      query += ' AND sales.sales_payroll IS NULL'
    }

    query += `
      ORDER BY 
        sales.sale_date DESC
    `

    const payrollItems = await selectMany<PayrollItem>(db, query, queryParams)

    return {
      payrollItems,
      currentFilter: paymentStatus,
    }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAdminUser(request)
  if (!user || !user.company_id) {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Error', 'Unauthorized', 'destructive'))
    return redirect('/login', {
      headers: { 'Set-Cookie': await commitSession(session) },
    })
  }

  const formData = await request.formData()
  const intent = formData.get('intent')
  const saleId = formData.get('saleId')
  const payrollAmount = formData.get('payrollAmount')

  // Сохраняем текущий URL для редиректа обратно
  const url = new URL(request.url)
  const redirectUrl = `/admin/payroll${url.search}`

  if (intent === 'set-payroll') {
    try {
      if (payrollAmount) {
        // Устанавливаем сумму зарплаты
        await db.execute(`UPDATE sales SET sales_payroll = ? WHERE id = ?`, [
          payrollAmount,
          saleId,
        ])
      } else {
        // Если сумма не указана, устанавливаем NULL (отмечаем как неоплаченную)
        await db.execute(`UPDATE sales SET sales_payroll = NULL WHERE id = ?`, [saleId])
      }

      const session = await getSession(request.headers.get('Cookie'))
      session.flash(
        'message',
        toastData(
          'Success',
          payrollAmount ? 'Payroll amount set' : 'Payroll marked as unpaid',
        ),
      )

      return redirect(redirectUrl, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    } catch (error) {
      console.error('Error updating payroll amount:', error)

      const session = await getSession(request.headers.get('Cookie'))
      session.flash(
        'message',
        toastData('Error', 'Failed to update payroll amount', 'destructive'),
      )

      return redirect(redirectUrl, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    }
  }

  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Error', 'Invalid action', 'destructive'))
  return redirect(redirectUrl, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function AdminPayroll() {
  const { payrollItems, currentFilter } = useLoaderData<typeof loader>()

  const columns: ColumnDef<PayrollItem>[] = [
    {
      accessorKey: 'seller_name',
      header: ({ column }) => <SortableHeader column={column} title='Seller' />,
    },
    {
      accessorKey: 'customer_name',
      header: ({ column }) => <SortableHeader column={column} title='Customer' />,
    },
    {
      accessorKey: 'sale_date',
      header: ({ column }) => <SortableHeader column={column} title='Sale Date' />,
      cell: ({ row }) => {
        const date = new Date(row.original.sale_date)
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(date)
      },
      sortingFn: 'datetime',
    },
    {
      accessorKey: 'sale_total',
      header: ({ column }) => <SortableHeader column={column} title='Sale Amount' />,
      cell: ({ row }) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(row.original.sale_total)
      },
    },
    {
      accessorKey: 'sales_payroll',
      header: ({ column }) => <SortableHeader column={column} title='Payroll Amount' />,
      cell: ({ row }) => {
        if (row.original.sales_payroll === null) {
          return <span className='text-gray-500'>Not set</span>
        }
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(row.original.sales_payroll)
      },
    },
    {
      accessorKey: 'sale_status',
      header: ({ column }) => <SortableHeader column={column} title='Status' />,
      cell: ({ row }) => {
        let colorClass = 'text-blue-500'
        if (row.original.sale_status === 'Cancelled') {
          colorClass = 'text-red-500'
        } else if (row.original.sale_status === 'Installed') {
          colorClass = 'text-green-500'
        }

        return <span className={colorClass}>{row.original.sale_status}</span>
      },
    },
    {
      accessorKey: 'paid_date',
      header: ({ column }) => <SortableHeader column={column} title='Paid Date' />,
      cell: ({ row }) => {
        if (!row.original.paid_date) return 'Not paid'

        const date = new Date(row.original.paid_date)
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(date)
      },
    },
    {
      accessorKey: 'payroll_status',
      header: ({ column }) => <SortableHeader column={column} title='Payroll Status' />,
      cell: ({ row }) => {
        if (row.original.sales_payroll !== null) {
          return (
            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
              <Check className='h-3 w-3 mr-1' /> Paid
            </span>
          )
        } else {
          return (
            <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'>
              <X className='h-3 w-3 mr-1' /> Unpaid
            </span>
          )
        }
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isPaid = row.original.sales_payroll !== null

        return (
          <>
            {isPaid ? (
              <div className='flex gap-2 items-center'>
                <Form method='post' className='inline-flex gap-2 items-center'>
                  <input type='hidden' name='intent' value='set-payroll' />
                  <input type='hidden' name='saleId' value={row.original.sale_id} />
                  <input
                    type='number'
                    name='payrollAmount'
                    defaultValue={row.original.sales_payroll || ''}
                    className='w-24 px-2 py-1 border rounded'
                    min='0'
                    step='0.01'
                  />
                  <Button type='submit' variant='default' size='sm'>
                    Update
                  </Button>
                </Form>

                <Form method='post'>
                  <input type='hidden' name='intent' value='set-payroll' />
                  <input type='hidden' name='saleId' value={row.original.sale_id} />
                  <input type='hidden' name='payrollAmount' value='' />
                  <Button type='submit' variant='destructive' size='sm'>
                    Mark Unpaid
                  </Button>
                </Form>
              </div>
            ) : (
              <Form method='post' className='inline-flex gap-2 items-center'>
                <input type='hidden' name='intent' value='set-payroll' />
                <input type='hidden' name='saleId' value={row.original.sale_id} />
                <input
                  type='number'
                  name='payrollAmount'
                  placeholder='Amount'
                  className='w-24 px-2 py-1 border rounded'
                  min='0'
                  step='0.01'
                />
                <Button type='submit' variant='default' size='sm'>
                  Set Payroll
                </Button>
              </Form>
            )}
          </>
        )
      },
    },
  ]

  return (
    <PageLayout title='Payroll Management'>
      <div className='mb-4 flex justify-between items-center'>
        <div className='flex items-center gap-4'>
          <h1 className='text-2xl font-bold'>Sales Payroll</h1>
          <div className='flex gap-4'>
            <a
              href='/admin/payroll'
              className={`px-3 py-1 rounded-md ${currentFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
            >
              All
            </a>
            <a
              href='/admin/payroll?paymentStatus=paid'
              className={`px-3 py-1 rounded-md ${currentFilter === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}
            >
              Paid
            </a>
            <a
              href='/admin/payroll?paymentStatus=unpaid'
              className={`px-3 py-1 rounded-md ${currentFilter === 'unpaid' ? 'bg-red-100 text-red-800' : 'bg-gray-100'}`}
            >
              Unpaid
            </a>
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={payrollItems} />

      <Outlet />
    </PageLayout>
  )
}
