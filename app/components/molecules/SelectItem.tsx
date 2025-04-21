import React from "react";
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

interface SelectInputProps<TFieldValues extends FieldValues = FieldValues> {
  name: string;
  placeholder?: string;
  field: ControllerRenderProps<TFieldValues>;
  disabled?: boolean;
  options: Array<string | Option>;
  className?: string;
}

export function SelectInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
}: SelectInputProps<TFieldValues>) {
  const cleanOptions: Option[] = options.map((option) => {
    if (typeof option === "string") {
      return { key: option.toLowerCase(), value: option };
    } else {
      const { key, value } = option;
      return {
        key: typeof key === "string" ? key.toLowerCase() : String(key),
        value,
      };
    }
  });

  const selectValue = String(field.value ?? "");

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        <Select
          value={selectValue}
          onValueChange={(val) => field.onChange(val)}
          disabled={disabled}
        >
          <SelectTrigger className="min-w-[150px]">
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
