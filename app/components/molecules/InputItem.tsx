import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

export function InputItem({
  name,
  placeholder,
  field,
  type,
  className,
  formClassName,
}: {
  name?: string;
  placeholder?: string;
  field: object;
  type?: string;
  className?: string;
  formClassName?: string;
}) {
  return (
    <FormItem className={formClassName}>
      {name && <FormLabel>{name}</FormLabel>}
      <FormControl>
        <Input
          className={className}
          type={type}
          placeholder={placeholder}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
