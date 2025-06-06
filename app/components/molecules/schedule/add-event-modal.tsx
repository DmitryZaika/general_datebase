import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import clsx from "clsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormProvider, FormField } from "@/components/ui/form";
import { Form } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EventFormData, eventSchema } from "~/schemas/events";
import { Variant } from "@/types";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { useEffect } from "react";

interface AddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: {
    title?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    variant?: Variant;
    id?: string;
  };
}

export default function AddEventModal({ 
  open, 
  onOpenChange, 
  defaultValues 
}: AddEventModalProps) {
  
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      start_date: defaultValues?.startDate || new Date(),
      end_date: defaultValues?.endDate || new Date(),
      color: getEventColor(defaultValues?.variant || "primary"),
      all_day: false,
      status: "scheduled",
    },
  });
  const { fullSubmit } = useFullFetcher(form, "/api/events");

  const { watch, setValue, reset } = form;
  const selectedColor = watch("color");

  // Reset form when modal opens/closes or defaultValues change
  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: defaultValues.title || "",
        description: defaultValues.description || "",
        start_date: defaultValues.startDate || new Date(),
        end_date: defaultValues.endDate || new Date(),
        color: getEventColor(defaultValues.variant || "primary"),
        all_day: false,
        status: "scheduled",
      });
    }
  }, [open, defaultValues, reset]);

  const colorOptions = [
    { key: "blue", name: "Blue" },
    { key: "red", name: "Red" },
    { key: "green", name: "Green" },
    { key: "yellow", name: "Yellow" },
  ];

  function getEventColor(variant: Variant) {
    switch (variant) {
      case "primary":
        return "blue";
      case "danger":
        return "red";
      case "success":
        return "green";
      case "warning":
        return "yellow";
      default:
        return "blue";
    }
  }

  const handleDateChange = (field: "start_date" | "end_date", date: Date) => {
    setValue(field, date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>

          <DialogTitle>
            {defaultValues?.id ? "Edit Event" : "Add Event"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {defaultValues?.id ? "Edit an existing event" : "Add a new event"}
          </DialogDescription>
        </DialogHeader>
        
        <FormProvider {...form}>
          <Form onSubmit={fullSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <div>
                  <Label htmlFor="title">Event Name</Label>
                  <Input
                    id="title"
                    {...field}
                    placeholder="Enter event name"
                    className={cn(form.formState.errors.title && "border-red-500")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...field}
                    placeholder="Enter event description"
                  />
                </div>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="datetime-local"
                      value={field.value instanceof Date ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                      onChange={(e) => handleDateChange("start_date", new Date(e.target.value))}
                    />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={field.value instanceof Date ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                      onChange={(e) => handleDateChange("end_date", new Date(e.target.value))}
                    />
                  </div>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="all_day"
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="all_day"
                    checked={field.value}
                    onChange={(e) => setValue("all_day", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="all_day">All Day Event</Label>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...field}
                    placeholder="Additional notes"
                  />
                </div>
              )}
            />

            <div>
              <Label>Color</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={clsx(
                      "w-fit my-2",
                      {
                        "bg-blue-500 hover:bg-blue-600 text-white": selectedColor === "blue",
                        "bg-red-500 hover:bg-red-600 text-white": selectedColor === "red",
                        "bg-green-500 hover:bg-green-600 text-white": selectedColor === "green",
                        "bg-yellow-500 hover:bg-yellow-600 text-white": selectedColor === "yellow",
                      }
                    )}
                  >
                    {colorOptions.find((color) => color.key === selectedColor)?.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {colorOptions.map((color) => (
                    <DropdownMenuItem
                      key={color.key}
                      onClick={() => {
                        setValue("color", color.key);
                      }}
                    >
                      <div className="flex items-center">
                        <div
                          className={clsx(
                            "w-4 h-4 rounded-full mr-2",
                            {
                              "bg-blue-500": color.key === "blue",
                              "bg-red-500": color.key === "red", 
                              "bg-green-500": color.key === "green",
                              "bg-yellow-500": color.key === "yellow",
                            }
                          )}
                        />
                        {color.name}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {defaultValues?.id ? "Update Event" : "Save Event"}
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}