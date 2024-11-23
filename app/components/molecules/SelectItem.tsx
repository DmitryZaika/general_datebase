import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, type ControllerRenderProps } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function SelectInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  options,
}: {
  name: string;
  placeholder: string;
  field: ControllerRenderProps<TFieldValues>;
  options: string[];
}) {
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Select {...field} onValueChange={field.onChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => (
              <SelectItem key={item} value={item.toLowerCase()}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
