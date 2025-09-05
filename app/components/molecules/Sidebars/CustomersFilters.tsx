import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigation, useSearchParams } from 'react-router'
import { SelectInput } from '~/components/molecules/SelectItem'
import { Checkbox } from '~/components/ui/checkbox'
import { FormField } from '~/components/ui/form'
import { SidebarGroupLabel, SidebarMenuSub } from '~/components/ui/sidebar'

interface SalesRep {
  id: number
  name: string
}

export function CustomersFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigation = useNavigation()
  const currentSalesRep = searchParams.get('sales_rep') ?? ''
  const currentShowInvalid = searchParams.get('show_invalid') === '1'

  const { data: reps = [] } = useQuery<SalesRep[]>({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const res = await fetch(`/api/sales-reps`)
      if (!res.ok) throw new Error('Failed to fetch reps')
      const json = await res.json()
      return json.users ?? []
    },
  })

  const options = useMemo(() => reps.map(r => ({ key: r.id, value: r.name })), [reps])

  const form = useForm<{ sales_rep: string; show_invalid: boolean }>({
    defaultValues: { sales_rep: currentSalesRep, show_invalid: currentShowInvalid },
  })

  // sync form value to URL
  useEffect(() => {
    const sub = form.watch(value => {
      const val = value.sales_rep
      const params = new URLSearchParams(searchParams)
      if (val) {
        params.set('sales_rep', val)
      } else {
        params.delete('sales_rep')
      }
      if (value.show_invalid) params.set('show_invalid', '1')
      else params.delete('show_invalid')
      setSearchParams(params)
    })
    return () => sub.unsubscribe()
  }, [form, searchParams, setSearchParams])

  const isSubmitting = navigation.state === 'submitting'

  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>Filters</SidebarGroupLabel>
      <FormProvider {...form}>
        <FormField
          control={form.control}
          name='sales_rep'
          render={({ field }) => (
            <SelectInput
              name='Sales rep'
              placeholder='Select rep'
              options={options}
              field={field}
              disabled={isSubmitting}
            />
          )}
        />
        <div className='mt-2 flex items-center gap-2'>
          <Checkbox
            checked={form.watch('show_invalid')}
            onCheckedChange={v => form.setValue('show_invalid', Boolean(v))}
            id='show_invalid'
          />
          <label htmlFor='show_invalid' className='text-sm'>
            Show invalid leads
          </label>
        </div>
      </FormProvider>
    </SidebarMenuSub>
  )
}
