import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

export function InputItem({
  name,
  placeholder,
  field,
}: {
  name: string;
  placeholder: string;
  field: object;
}) {
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Input placeholder={placeholder} {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
