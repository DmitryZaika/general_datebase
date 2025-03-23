// app/components/molecules/TypeSelect.tsx
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Option = { key: string; value: string };

export function TypeSelect<TFieldValues extends FieldValues = FieldValues>({
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
  const cleanOptions: Option[] = options.map((option) =>
    typeof option === "string"
      ? { key: option.toLowerCase(), value: option }
      : { key: option.key.toLowerCase(), value: option.value },
  );

  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Select
          value={field.value || ""}
          onValueChange={(val) => field.onChange(val)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {cleanOptions.map(({ key, value }) => (
              <SelectItem key={key} value={key}>
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
