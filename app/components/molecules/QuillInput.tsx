import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { QuillEditor } from "../atoms/QuillEditor";

export function QuillInput({
  name,
  field,
}: {
  name: string;
  field: object;
  className?: string;
}) {
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <QuillEditor {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
