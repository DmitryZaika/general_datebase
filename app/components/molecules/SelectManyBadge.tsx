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
import { Badge } from "../ui/badge";

type Option = { key: string | number; value: string };

interface SelectManyBadgeProps<TFieldValues extends FieldValues = FieldValues> {
  name: string;
  placeholder?: string;
  field: ControllerRenderProps<TFieldValues>;
  disabled?: boolean;
  options: Option[];
  className?: string;
  badges: Record<string, string>;
}

export function SelectManyBadge<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
  badges
}: SelectManyBadgeProps<TFieldValues>) {
  const value: string[] = field.value ?? [];
  console.log(value)
  function handleChange(val: string) {
    if (!val) return;
    if (value.includes(val)) return;
    field.onChange([...value, val])
  }

  function isLightColor(color: string) {
    const hex = color.replace('#', '');
    const c_r = parseInt(hex.substring(0, 2), 16);
    const c_g = parseInt(hex.substring(2, 4), 16);
    const c_b = parseInt(hex.substring(4, 6), 16);
    const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
    return brightness > 155;
  }

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={field.name}>{name}</FormLabel>
      <FormControl>
        <Select
          onValueChange={handleChange}
          disabled={disabled}
        >
          <SelectTrigger className="min-w-[150px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ key, value }) => (
              <SelectItem key={key} value={key}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
      </FormControl>
      <FormMessage />
      {Object.keys(badges).map(item => (
        <Badge key={item} style={{
          backgroundColor: badges[item],
          color: isLightColor(badges[item]) ? '#000000' : '#ffffff'
        }}>{item}</Badge>
      ))}
    </FormItem>
  );
}
