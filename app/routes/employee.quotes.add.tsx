import { zodResolver } from "@hookform/resolvers/zod"
import mysql from "mysql2"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { Form, redirect, useNavigate, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router"
import { getValidatedFormData } from "remix-hook-form"
import { AuthenticityTokenInput } from "remix-utils/csrf/react"
import { z } from "zod"
import { CustomerSearch } from "~/components/molecules/CustomerSearch"
import { InputItem } from "~/components/molecules/InputItem"
import { LoadingButton } from "~/components/molecules/LoadingButton"
import { SelectInput } from "~/components/molecules/SelectItem"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { FormField } from "~/components/ui/form"
import { db } from "~/db.server"
import { useFullSubmit } from "~/hooks/useFullSubmit"
import { commitSession, getSession } from "~/sessions"
import { csrf } from "~/utils/csrf.server"
import { getEmployeeUser, type User } from "~/utils/session.server"

const quoteSchema = z.object({
    customer_id: z.number().min(1, 'Customer is required'),
    quote_name: z.string().min(1, 'Quote name is required'),
    quote_type: z.string().min(1, 'Quote type is required'),
})

const QuoteType = {
    'Builder/Contractor': 'Builder/Contractor',
    'Homeowner': 'Homeowner',
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request)
    return { companyId: user.company_id }
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
}

export async function action({ request }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const resolver = zodResolver(quoteSchema)

  const { errors, data, receivedValues } =
    await getValidatedFormData<z.infer<typeof quoteSchema>>(request, resolver)
  if (errors) {
    return { errors, receivedValues }
  }
  const parsed = quoteSchema.safeParse({
    customer_id: receivedValues.customer_id,
    quote_name: receivedValues.quote_name,
    quote_type: receivedValues.quote_type,
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const [result] = await db.execute<mysql.ResultSetHeader>(
    `INSERT INTO quotes (customer_id, quote_name, quote_type, created_date, sales_rep, company_id) VALUES (?, ?, ?, NOW(), ?, ?);`,
    [receivedValues.customer_id, receivedValues.quote_name, receivedValues.quote_type, user.id, user.company_id],
  )

  const session = await getSession(request.headers.get('Cookie'))
  return redirect(`../../draw/${result.insertId}`, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function EmployeeQuotesAdd() {
    const navigate = useNavigate()
    const form = useForm<z.infer<typeof quoteSchema>>({
        resolver: zodResolver(quoteSchema),
        defaultValues: {
            quote_name: ''    
        },
    })

    const [open, setOpen] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleClose = () => {
        setOpen(false)
        navigate('..')
    }
    console.log(form.getValues())
    const fullSubmit = useFullSubmit(form)
    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Quote</DialogTitle>
                </DialogHeader>
                <FormProvider {...form}>
                    <Form method='post' className="space-y-4" onSubmit={fullSubmit}>
                        <AuthenticityTokenInput />
                            <CustomerSearch onCustomerChange={(value) => {form.setValue('customer_id', value ?? (undefined as unknown as number))}} selectedCustomer={form.watch('customer_id') ?? undefined} companyId={0} source='user-input' error={form.formState.errors.customer_id?.message} setError={(error) => {form.setError('customer_id', { message: error ?? undefined })}} />
                        <FormField control={form.control} name='quote_name' render={({ field }) => (
                            <InputItem name='Quote name' type='text' field={field} />
                        )} />
                        <FormField
                            control={form.control}
                            name='quote_type'
                            render={({ field }) => (
                            <SelectInput
                                field={{
                                ...field,
                                value: field.value,
                                onChange: (value: string) => field.onChange(value),
                                }}
                                placeholder='Select option'
                                name='Quote type'
                                options={Object.keys(QuoteType).map(key => ({
                                key: key,
                                value: key,
                                }))}
                            />
                            )}
                        />
                        <Button type='submit'>
                            <LoadingButton loading={isSubmitting}>
                                Create Quote
                            </LoadingButton>
                        </Button>
                    </Form>
                </FormProvider>
            </DialogContent>
        </Dialog>
        
    )
}

