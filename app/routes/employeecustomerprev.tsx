import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { type ActionFunctionArgs, Form, useActionData } from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { InputItem } from '~/components/molecules/InputItem'
import { PageLayout } from '~/components/PageLayout'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider,
} from '../components/ui/form'
import { Input } from '../components/ui/input'

const customerSchema = z.object({
  name: z.string().min(5),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(10).optional(),
  address: z.string().min(10).optional(),
})

type FormData = z.infer<typeof customerSchema>

const resolver = zodResolver(customerSchema)

export async function action({ request }: ActionFunctionArgs) {
  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, resolver)
  if (errors) {
    return { errors, defaultValues }
  }

  await db.execute(
    `INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)`,
    [data.name, data.email, data.phoneNumber, data.address],
  )
  return { success: true }
}

export default function Customer() {
  const actionData = useActionData<typeof action>()
  const form = useForm<FormData>({
    resolver,
  })
  const fullSubmit = useFullSubmit(form)

  return (
    <PageLayout
      className='bg-white p-5 rounded-lg shadow-[0px_-0px_5px_rgba(0,0,0,0.15)]  max-w-lg mx-auto my-5'
      title='Customers
    '
    >
      <h2 id='formTitle' className='text-xl mb-4 text-gray-800'>
        Add New Customer
      </h2>
      {actionData?.success && <h3>Success</h3>}
      <FormProvider {...form}>
        <Form id='customerForm' method='post' onSubmit={fullSubmit}>
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <InputItem name={'Name'} placeholder={'Your name'} field={field} />
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder='Your Email' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='phoneNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input placeholder='Your phone number' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder='Your address' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit'>Submit</Button>
        </Form>
      </FormProvider>
    </PageLayout>
  )
}
