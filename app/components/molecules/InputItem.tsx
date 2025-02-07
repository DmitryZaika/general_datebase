import React, { forwardRef } from "react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

interface InputItemProps {
  name?: string;
  placeholder?: string;
  field: object;
  type?: string;
  className?: string;
  formClassName?: string;
  inputAutoFocus?: boolean;
}

export const InputItem = ({
  name,
  placeholder,
  field,
  type,
  className,
  formClassName,
  inputAutoFocus,
}: InputItemProps) => {
  return (
    <FormItem className={formClassName}>
      {name && <FormLabel>{name}</FormLabel>}
      <FormControl>
        <Input
          className={className}
          type={type}
          placeholder={placeholder}
          autoFocus={inputAutoFocus}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
};

InputItem.displayName = "InputItem";
