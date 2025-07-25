import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigation, useSearchParams } from 'react-router'
import { SelectInput } from '~/components/molecules/SelectItem'
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

  const form = useForm<{ sales_rep: string }>({
    defaultValues: { sales_rep: currentSalesRep },
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
      </FormProvider>
    </SidebarMenuSub>
  )
}
