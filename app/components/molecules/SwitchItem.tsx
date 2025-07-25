import type { Field } from 'react-hook-form'
import { Switch } from '~/components/ui/switch'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

export function SwitchItem({ name, field }: { name: string; field: Field }) {
  return (
    <FormItem>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
      <FormLabel>{name}</FormLabel>
      <FormMessage />
    </FormItem>
  )
}
