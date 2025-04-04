import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, ControllerRenderProps } from "react-hook-form";
import { cn } from "~/lib/utils";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

type Option = { key: string; value: string };

interface ColorSelectProps<TFieldValues extends FieldValues = FieldValues> {
  name: string;
  placeholder?: string;
  field: ControllerRenderProps<TFieldValues> & { value: string[] };
  disabled?: boolean;
  options: Array<string | Option>;
  className?: string;
}

function areArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

export function ColorSelect<TFieldValues extends FieldValues = FieldValues>({
  name,
  field,
  placeholder,
  disabled,
  options,
  className,
}: ColorSelectProps<TFieldValues>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo(() => {
    return options.map((option) => {
      if (typeof option === "string") {
        return { key: option.toLowerCase(), value: option };
      } else {
        return { key: option.key, value: option.value };
      }
    });
  }, [options]);

  const selectedValues: string[] = Array.isArray(field.value) 
    ? field.value 
    : field.value ? [field.value] : [];

  const valueRef = useRef(selectedValues);
  
  useEffect(() => {
    if (!areArraysEqual(valueRef.current, selectedValues)) {
      valueRef.current = selectedValues;
    }
  }, [selectedValues]);

  const handleOptionToggle = useCallback(
    (optionKey: string) => {
      const currentValues = [...valueRef.current];
      
      let newValues: string[];
      if (currentValues.includes(optionKey)) {
        newValues = currentValues.filter((key) => key !== optionKey);
      } else {
        newValues = [...currentValues, optionKey];
      }
      
      if (!areArraysEqual(currentValues, newValues)) {
        valueRef.current = newValues;
        field.onChange(newValues);
      }
    },
    [field]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const displayText = useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder || "Select colors";
    } else if (selectedValues.length === 1) {
      const selectedOption = normalizedOptions.find((opt) => opt.key === selectedValues[0]);
      return selectedOption ? selectedOption.value : selectedValues[0];
    } else {
      return `${selectedValues.length} colors selected`;
    }
  }, [selectedValues, normalizedOptions, placeholder]);

  return (
    <FormItem className={className}>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-white placeholder:text-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 dark:border-zinc-800 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300",
              open && "ring-1 ring-zinc-950",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="text-left">{displayText}</span>
            <CaretSortIcon className="h-4 w-4 opacity-50" />
          </button>
          {open && (
            <div className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-md animate-in fade-in-0 zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
              {normalizedOptions.map((option) => {
                const isSelected = selectedValues.includes(option.key);
                return (
                  <div
                    key={option.key}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      isSelected && "bg-zinc-100 dark:bg-zinc-800"
                    )}
                    onClick={() => handleOptionToggle(option.key)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={cn(
                        "flex h-4 w-4 items-center justify-center border border-zinc-900 rounded-sm",
                        isSelected && "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      )}>
                        {isSelected && <CheckIcon className="h-3 w-3" />}
                      </div>
                      <span className="flex-grow">{option.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
