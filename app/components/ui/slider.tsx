import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "~/lib/utils"

export interface SliderProps
  extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /** Показывать всплывающую подсказку со значением */
  showTooltip?: boolean
  /**
   * Вызывается один раз, когда пользователь завершает перетаскивание.
   * Аналог `onValueCommit` Radix.
   */
  onCommit?: (value: number[]) => void
}

/**
 * Расширенный слайдер с поддержкой всплывающих подсказок и задержкой
 * вызова внешнего колбэка до окончания перетаскивания.
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(function Slider(
  {
    className,
    defaultValue,
    value,
    min = 0,
    max = 100,
    showTooltip = false,
    onCommit,
    onValueChange,
    ...props
  },
  ref
) {
  const [isDragging, setIsDragging] = React.useState(false);
  // Track if we're in controlled or uncontrolled mode
  const isControlled = value !== undefined;
  
  // Локальное состояние для неконтролируемого режима и отображения в тултипе
  const [internalValue, setInternalValue] = React.useState<number[]>(
    () => {
      if (isControlled) {
        return Array.isArray(value) ? value : [min];
      }
      return Array.isArray(defaultValue) ? defaultValue : [min];
    }
  )

  // Sync internal state with controlled value when it changes
  React.useEffect(() => {
    if (isControlled && value !== internalValue) {
      setInternalValue(Array.isArray(value) ? value : [min]);
    }
  }, [isControlled, value, min, internalValue]);
  
  // Track dragging state
  const handleDragStart = React.useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Обновляем локальное состояние во время перетаскивания
  const handleChange = React.useCallback((val: number[]) => {
    setInternalValue(val);
    if (!isDragging) {
      // Only call external onChange when not dragging
      onValueChange?.(val);
    }
  }, [isDragging, onValueChange]);

  // Однократный вызов колбэка после отпускания
  const handleCommit = React.useCallback(
    (val: number[]) => {
      onCommit?.(val);
      if (!isControlled) {
        onValueChange?.(val);
      }
    },
    [onCommit, onValueChange, isControlled]
  );

  const renderThumb = (index: number) => {
    const thumb = (
      <SliderPrimitive.Thumb
        key={index}
        data-slot="slider-thumb"
        className="border-zinc-900 bg-white ring-zinc-950/50 block size-4 shrink-0 rounded-full border border-zinc-200 shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-50 dark:bg-zinc-950 dark:ring-zinc-300/50 dark:border-zinc-800"
      />
    )

    if (!showTooltip || !isDragging) return thumb;

    return (
      <TooltipPrimitive.Root key={index} delayDuration={0} open>
        <TooltipPrimitive.Trigger asChild>{thumb}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Content
          side="top"
          align="center"
          className="select-none rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md dark:bg-zinc-50 dark:text-zinc-900"
        >
          {internalValue[index]}
          <TooltipPrimitive.Arrow className="fill-current" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Root>
    )
  }

  return (
    <SliderPrimitive.Root
      ref={ref}
      data-slot="slider"
      value={isControlled ? value : undefined}
      defaultValue={!isControlled ? defaultValue : undefined}
      min={min}
      max={max}
      onValueChange={handleChange}
      onValueCommit={handleCommit}
      onPointerDown={handleDragStart}
      onPointerUp={handleDragEnd}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-zinc-100 relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 dark:bg-zinc-800"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-zinc-900 absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full dark:bg-zinc-50"
          )}
        />
      </SliderPrimitive.Track>
      {internalValue.map((_, i) => renderThumb(i))}
    </SliderPrimitive.Root>
  )
})

