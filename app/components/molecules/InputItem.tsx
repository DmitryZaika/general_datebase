import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

export function InputItem({
  name,
  placeholder,
  field,
  type,
}: {
  name: string;
  placeholder: string;
  field: object;
  type?: string;
}) {
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Input type={type} placeholder={placeholder} {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
