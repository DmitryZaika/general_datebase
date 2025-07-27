import type { ControllerRenderProps, FieldValues, Path } from 'react-hook-form'
import { Switch } from '~/components/ui/switch'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

interface SwitchItemProps<T extends FieldValues, V extends Path<T>> {
  name: string
  field: ControllerRenderProps<T, V>
}

export function SwitchItem<T extends FieldValues, V extends Path<T>>({
  name,
  field,
}: SwitchItemProps<T, V>) {
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
