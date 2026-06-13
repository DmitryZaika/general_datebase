import { QuillEditor } from '../atoms/QuillEditor'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

export function QuillInput({
  name,
  field,
  className,
  onFilesDrop,
  onSubmitShortcut,
}: {
  name: string
  field: object & { onChange: (value: string) => void; value: string }
  className?: string
  onFilesDrop?: (files: File[]) => void
  onSubmitShortcut?: () => void
}) {
  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <QuillEditor
          {...field}
          onFilesDrop={onFilesDrop}
          onSubmitShortcut={onSubmitShortcut}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
