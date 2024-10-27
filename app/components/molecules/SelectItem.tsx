import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function SelectInput({
  name,
  field,
  placeholder,
  options,
}: {
  name: string;
  placeholder: string;
  field: object;
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
