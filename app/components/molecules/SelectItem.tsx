import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, ControllerRenderProps } from "react-hook-form";
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
  options: Array<string | Option>;
  className?: string;
}) {
  // Приводим все варианты options к массиву { key, value }
  const cleanOptions: Option[] = options.map((option) =>
    typeof option === "string"
      ? { key: option, value: option }
      : { key: option.key, value: option.value }
  );

  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Select
          value={String(field.value ?? "")}
          onValueChange={(val) => field.onChange(Number(val))}
          disabled={disabled}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {cleanOptions.map(({ key, value }) => (
              <SelectItem key={key} value={String(key)}>
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
