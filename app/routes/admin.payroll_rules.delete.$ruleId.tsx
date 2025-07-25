import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

interface PayrollRule {
  id: number
  name: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    if (!params.ruleId) {
      return redirect('/admin/payroll_rules')
    }

    const ruleId = parseInt(params.ruleId, 10)

    if (Number.isNaN(ruleId)) {
      return redirect('/admin/payroll_rules')
    }

    const payrollRule = await selectMany<PayrollRule>(
      db,
      `SELECT id, name
       FROM payroll
       WHERE id = ? AND company_id = ?`,
      [ruleId, user.company_id],
    )

    if (payrollRule.length === 0) {
      return redirect('/admin/payroll_rules')
    }

    return { payrollRule: payrollRule[0] }
  } catch {
    return redirect('/admin/payroll_rules')
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    if (!params.ruleId) {
      return redirect('/admin/payroll_rules')
    }

    const ruleId = parseInt(params.ruleId, 10)

    if (Number.isNaN(ruleId)) {
      return redirect('/admin/payroll_rules')
    }

    // Delete the payroll rule
    await db.execute(`DELETE FROM payroll WHERE id = ? AND company_id = ?`, [
      ruleId,
      user.company_id,
    ])

    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Payroll rule deleted successfully'))

    return redirect('/admin/payroll_rules', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  } catch {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Error', 'Failed to delete payroll rule', 'destructive'),
    )

    return redirect('/admin/payroll_rules', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  }
}

export default function DeletePayrollRule() {
  const { payrollRule } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      navigate('/admin/payroll_rules')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Delete Payroll Rule</DialogTitle>
        </DialogHeader>

        <div className='py-4'>
          <p className='text-gray-700'>
            Are you sure you want to delete the payroll rule{' '}
            <span className='font-semibold'>{payrollRule.name}</span>?
          </p>
          <p className='mt-2 text-gray-600 text-sm'>This action cannot be undone.</p>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => handleDialogChange(false)}>
            Cancel
          </Button>
          <Form method='post'>
            <Button type='submit' variant='destructive'>
              Delete Rule
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
