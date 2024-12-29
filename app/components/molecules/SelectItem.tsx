import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, type ControllerRenderProps } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Option = { key: string | number; value: string };

export function SelectInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
}: {
  name: string;
  placeholder?: string;
  field: ControllerRenderProps<TFieldValues>;
  disabled?: boolean;
  options: string[] | Option[];
  className?: string;
}) {
  const cleanOptions: Option[] = (options as (string | Option)[]).map(
    (option) =>
      typeof option === "string"
        ? { key: option, value: option }
        : { key: option.key, value: option.value }
  );
  function cleanValue(value: string | number) {
    if (typeof value === "string") {
      return value.toLowerCase();
    }
    return value.toString();
  }

  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Select {...field} onValueChange={field.onChange} disabled={disabled}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {cleanOptions.map(({ key, value }: Option) => (
              <SelectItem key={key} value={cleanValue(key)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
