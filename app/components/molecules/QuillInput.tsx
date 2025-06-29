import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'
import { QuillEditor } from '../atoms/QuillEditor'

export function QuillInput({
  name,
  field,
  className,
}: {
  name: string
  field: object & { onChange: (value: string) => void; value: string }
  className?: string
}) {
  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <QuillEditor {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
