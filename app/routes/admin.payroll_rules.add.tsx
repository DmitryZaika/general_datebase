import { useState } from 'react'
import {
  type ActionFunctionArgs,
  Form,
  redirect,
  useActionData,
  useNavigate,
} from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

const payrollRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().positive('Amount must be a positive number'),
  type: z.enum(['percentage', 'fixed'], {
    errorMap: () => ({ message: 'Type must be either percentage or fixed' }),
  }),
})

type PayrollRuleFormData = z.infer<typeof payrollRuleSchema>
type ActionData = { errors?: Partial<Record<keyof PayrollRuleFormData, string>> }

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const amountStr = formData.get('amount') as string
    const type = formData.get('type') as string

    // Validate form data
    const result = payrollRuleSchema.safeParse({
      name,
      amount: amountStr ? parseFloat(amountStr) : undefined,
      type,
    })

    if (!result.success) {
      // Return validation errors
      const errors = result.error.flatten().fieldErrors
      return { errors }
    }

    const { amount } = result.data

    await db.execute(
      `INSERT INTO payroll (name, amount, type, company_id) 
       VALUES (?, ?, ?, ?)`,
      [name, amount, type, user.company_id],
    )

    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Payroll rule added successfully'))

    return redirect('/admin/payroll_rules', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  } catch {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Error', 'Failed to add payroll rule', 'destructive'),
    )

    return redirect('/admin/payroll_rules', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  }
}

export default function AddPayrollRule() {
  const navigate = useNavigate()
  const [type, setType] = useState<string>('')
  const actionData = useActionData<ActionData>()

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      navigate('/admin/payroll_rules')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Payroll Rule</DialogTitle>
        </DialogHeader>

        <Form method='post' className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>Rule Name</Label>
            <Input id='name' name='name' placeholder='e.g. Base Commission' required />
            {actionData?.errors?.name && (
              <p className='text-sm text-red-500'>{actionData.errors.name}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='amount'>Amount</Label>
            <Input
              id='amount'
              name='amount'
              type='number'
              step='0.01'
              placeholder='Enter amount'
              required
            />
            {actionData?.errors?.amount && (
              <p className='text-sm text-red-500'>{actionData.errors.amount}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='type'>Type</Label>
            <Select name='type' value={type} onValueChange={setType} required>
              <SelectTrigger>
                <SelectValue placeholder='Select type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='percentage'>Percentage</SelectItem>
                <SelectItem value='fixed'>Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
            {actionData?.errors?.type && (
              <p className='text-sm text-red-500'>{actionData.errors.type}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              type='button'
              onClick={() => handleDialogChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit'>Add Rule</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
