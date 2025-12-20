import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Star } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import z from 'zod'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { SelectInput } from '~/components/molecules/SelectItem'
import { Button } from '~/components/ui/button'
import { FormField } from '~/components/ui/form'
import { Textarea } from '~/components/ui/textarea'
import { db } from '~/db.server'
import { useFullSubmit } from '~/hooks/useFullSubmit'
import { selectMany } from '~/utils/queryHelpers'

const surveySchema = z.object({
  sales_rep_id: z.coerce.number().min(1),
  sales_rep_rating: z.coerce.number().min(1).max(5),
  sales_rep_comments: z.string().optional(),
  technician_rating: z.coerce.number().min(1).max(5),
  technician_comments: z.string().optional(),
  installation_rating: z.coerce.number().min(1).max(5),
  installation_comments: z.string().optional(),
})

type SurveyForm = z.infer<typeof surveySchema>
const resolver = zodResolver(surveySchema)


type SalesRep = { id: number; name: string }


export const loader = async ({ params }: LoaderFunctionArgs) => {
  const companyId = Number(params.company)
  const salesReps: SalesRep[] = await selectMany<SalesRep>(
    db,
    `SELECT DISTINCT u.id, u.name
     FROM users u
     JOIN users_positions up ON up.user_id = u.id
     WHERE up.company_id = ?
       AND up.position_id = 1
       AND u.is_deleted = 0
     ORDER BY u.name ASC`,
    [companyId],
  )
  return { companyId, salesReps }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const companyId = Number(params.company)
  const { errors, data} = await getValidatedFormData<SurveyForm>(
    request,
    resolver,
  )
  if (errors) {
    return { errors }
  }
  if (!data) {
    return { error: 'No data submitted' }
  }
  try {
    await db.execute(
      `INSERT INTO customer_surveys (
        sales_rep_id,
        sales_rep_rating,
        sales_rep_comments,
        technician_rating,
        technician_comments,
        installation_rating,
        installation_comments,
        company_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.sales_rep_id,
        data.sales_rep_rating,
        data.sales_rep_comments,
        data.technician_rating,
        data.technician_comments,
        data.installation_rating,
        data.installation_comments,
        companyId,
      ]
    )

    return redirect(`/customer/${companyId}/survey?submitted=1`)
  } catch (error) {
    console.error('Error saving survey:', error)
    return redirect(`/customer/${companyId}/survey?error=1`)
  }
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-4'>
      <div className='text-lg font-semibold'>{title}</div>
      <div className='mt-3 space-y-4'>{children}</div>
    </div>
  )
}

function StarRating({
  name,
  value,
  onChange,
  invalid,
  disabled,
}: {
  name: string
  value: number | null | undefined
  onChange: (value: number) => void
  invalid: boolean
  disabled: boolean
}) {
  const stars = useMemo(() => [1, 2, 3, 4, 5], [])
  return (
    <div
      className={
        invalid
          ? 'flex items-center gap-2 rounded-md border border-red-500 px-2 py-1'
          : 'flex items-center gap-2 rounded-md border border-transparent px-2 py-1'
      }
    >
      <input
        type='hidden'
        name={name}
        value={value === null || value === undefined ? '' : String(value)}
      />
      <div className='flex items-center gap-1'>
        {stars.map(starValue => {
          const filled = value !== null && value !== undefined && starValue <= value
          const unfilledClass =
            invalid && (value === null || value === undefined)
              ? 'h-5 w-5 text-red-500'
              : 'h-5 w-5 text-zinc-300'
          return (
            <Button
              key={starValue}
              type='button'
              onClick={() => onChange(starValue)}
              aria-label={`${starValue} star`}
              variant='ghost'
              size='icon'
              className='w-8 h-8'
              disabled={disabled}
            >
              <Star
                className={filled ? 'h-5 w-5 text-yellow-500' : unfilledClass}
                fill={filled ? 'currentColor' : 'none'}
              />
            </Button>
          )
        })}
      </div>
      <div className='text-sm text-zinc-500'>
        {value === null || value === undefined ? '' : `${value}/5`}
      </div>
    </div>
  )
}

export default function Survey() {
  const { companyId, salesReps } = useLoaderData<typeof loader>()
  const [searchParams] = useSearchParams()
  const submitted = searchParams.get('submitted') === '1'
  const error = searchParams.get('error') === '1'
  const salesRepSelectRef = useRef<HTMLButtonElement>(null)
  const navigation = useNavigation()
  const isSubmitting = navigation.state !== 'idle'  

  const options = useMemo(() => salesReps.map(r => ({ key: r.id, value: r.name })), [salesReps])

  const form = useForm<SurveyForm>({
    resolver,
    defaultValues: {
      sales_rep_id: undefined,
      sales_rep_rating: undefined,
      sales_rep_comments: '',
      technician_rating: undefined,
      technician_comments: '',
      installation_rating: undefined,
      installation_comments: '',
    },
  })

  const fullSubmit = useFullSubmit(form, `/customer/${companyId}/survey`, 'POST')
  const salesRepId = form.watch('sales_rep_id')
  const salesRepRating = form.watch('sales_rep_rating')
  const technicianRating = form.watch('technician_rating')
  const installationRating = form.watch('installation_rating')
  useEffect(() => {
    if (form.formState.submitCount > 0 && form.formState.errors.sales_rep_id && salesRepSelectRef.current) {
      salesRepSelectRef.current.focus()
    }
  }, [form.formState.submitCount, form.formState.errors.sales_rep_id])

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-4 p-4'>
      <div>
        <p className='text-center text-xl font-light text-zinc-800 leading-relaxed'>
          Please fill out the survey to help us improve our service. This survey is <span className='font-normal text-zinc-900'>FULLY ANONYMOUS</span>.
        </p>
      </div>

    

      {error ? (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800'>
          Please fill required fields.
        </div>
      ) : null}
      <FormProvider {...form}>
        <Form id='customerForm' method='post' onSubmit={fullSubmit}>
          <div className='space-y-4'>
            <SectionCard title='Pick your sales rep'>
            <FormField
          control={form.control}
          name='sales_rep_id'
          render={({ field }) => (
            <SelectInput
              name='Sales rep'
              placeholder='Select rep'
              options={options}
              field={field}
              disabled={submitted}
              />
            )}></FormField>
            </SectionCard>

            <SectionCard title='How did you like the sales rep?'>
              <div className='space-y-2'>
                <StarRating
                  name='sales_rep_rating'
                  value={salesRepRating}
                  onChange={val => form.setValue('sales_rep_rating', val, { shouldValidate: true })}
                  invalid={form.formState.submitCount > 0 && !!form.formState.errors.sales_rep_rating}
                  disabled={submitted}
                />
              </div>
              <div className='space-y-2'>
                <Textarea {...form.register('sales_rep_comments')} rows={4} disabled={submitted} />
              </div>
            </SectionCard>

            <SectionCard title='How did you like the technician?'>
              <div className='space-y-2'>
                <StarRating
                  name='technician_rating'
                  value={technicianRating}
                  onChange={val => form.setValue('technician_rating', val, { shouldValidate: true })}
                  invalid={form.formState.submitCount > 0 && !!form.formState.errors.technician_rating}
                  disabled={submitted}
                />
              </div>
              <div className='space-y-2'>
                <Textarea {...form.register('technician_comments')} rows={4} disabled={submitted} />
              </div>
            </SectionCard>

            <SectionCard title='How did you like the installation team?'>
              <div className='space-y-2'>
                <StarRating
                  name='installation_rating'
                  value={installationRating}
                  onChange={val => form.setValue('installation_rating', val, { shouldValidate: true })}
                  invalid={form.formState.submitCount > 0 && !!form.formState.errors.installation_rating}
                  disabled={submitted}
                />
              </div>
              <div className='space-y-2'>
                <Textarea {...form.register('installation_comments')} rows={4} disabled={submitted} />
              </div>
            </SectionCard>

            {submitted ? (
              <div className='rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800'>
                Thank you! Your feedback was submitted.
              </div>
            ) : null}

            <div className='flex justify-end'>
              {submitted ? (
                <Button type='button' disabled className='w-12'>
                  <Check className='h-5 w-5' />
                </Button>
              ) : (
                <LoadingButton type='submit' loading={isSubmitting}>
                  Submit
                </LoadingButton>
              )}
            </div>
          </div>
        </Form>
      </FormProvider>
    </div>
  )
}