import { QuillEditor } from '../atoms/QuillEditor'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

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
