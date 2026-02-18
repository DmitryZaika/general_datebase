import { QuillEditor } from '../atoms/QuillEditor'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

export function QuillInput({
  name,
  field,
  className,
  onFilesDrop,
}: {
  name: string
  field: object & { onChange: (value: string) => void; value: string }
  className?: string
  onFilesDrop?: (files: File[]) => void
}) {
  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <QuillEditor {...field} onFilesDrop={onFilesDrop} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
