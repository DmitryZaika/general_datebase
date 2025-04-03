import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { FieldValues, ControllerRenderProps } from "react-hook-form";
import { Checkbox } from "../ui/checkbox";
import { cn } from "~/lib/utils";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

type Option = { key: string; value: string };

interface ColorSelectProps<TFieldValues extends FieldValues = FieldValues> {
  name: string;
  placeholder?: string;
  field: ControllerRenderProps<TFieldValues>;
  disabled?: boolean;
  options: Array<string | Option>;
  className?: string;
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
  
  // Нормализуем опции в формат { key, value }
  const normalizedOptions = useMemo(() => {
    return options.map((option) => {
      if (typeof option === "string") {
        return { key: option.toLowerCase(), value: option };
      } else {
        return { key: option.key, value: option.value };
      }
    });
  }, [options]);

  // Для отслеживания изменений без использования эффектов
  const fieldValueRef = useRef<any>(field.value);
  
  // Инициализируем выбранные значения
  const selectedValues: string[] = 
    Array.isArray(field.value) ? field.value : [];
  
  // Обработчик выбора опции
  const handleOptionToggle = useCallback((optionKey: string) => {
    // Для избежания цикла обновлений, проверяем текущее значение
    const currentValues: string[] = Array.isArray(field.value) ? field.value : [];
    
    // Создаем новый массив выбранных значений
    let newValues;
    if (currentValues.includes(optionKey)) {
      newValues = currentValues.filter(key => key !== optionKey);
    } else {
      newValues = [...currentValues, optionKey];
    }
    
    // Только если значение изменилось, вызываем onChange
    if (JSON.stringify(currentValues) !== JSON.stringify(newValues)) {
      fieldValueRef.current = newValues;
      field.onChange(newValues);
    }
  }, [field]);

  // Закрытие при клике вне компонента
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Текст для отображения в кнопке
  const displayText = useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder || "Select colors";
    } else if (selectedValues.length === 1) {
      const selectedOption = normalizedOptions.find(opt => opt.key === selectedValues[0]);
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
            <div 
              className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-md animate-in fade-in-0 zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {normalizedOptions.map((option) => {
                const isSelected = selectedValues.includes(option.key);
                return (
                  <div
                    key={option.key}
                    className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-hidden hover:bg-zinc-100 focus:bg-zinc-100 focus:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-zinc-800"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionToggle(option.key);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        className="mr-1"
                      />
                      {option.value}
                    </div>
                    {isSelected && (
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                    )}
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
