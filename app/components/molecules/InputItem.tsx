import React, { forwardRef } from "react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

interface InputItemProps {
  name?: string;
  placeholder?: string;
  field?: object;
  type?: string;
  className?: string;
  formClassName?: string;
  inputAutoFocus?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export const InputItem = forwardRef<HTMLInputElement, InputItemProps>(({
  name,
  placeholder,
  field,
  type,
  className,
  formClassName,
  inputAutoFocus,
}: InputItemProps, ref) => {
  return (
    <FormItem className={formClassName}>
      {name && <FormLabel>{name}</FormLabel>}
      <FormControl>
        <Input
          className={className}
          type={type}
          placeholder={placeholder}
          autoFocus={inputAutoFocus}
          ref={ref}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
});

InputItem.displayName = "InputItem";
