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
}

export const InputItem = forwardRef<HTMLInputElement, InputItemProps>(
  ({ name, placeholder, field, type, className, formClassName }, inputRef) => {
    return (
      <FormItem className={formClassName}>
        {name && <FormLabel>{name}</FormLabel>}
        <FormControl>
          <Input
            ref={inputRef}
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
);

InputItem.displayName = "InputItem";
