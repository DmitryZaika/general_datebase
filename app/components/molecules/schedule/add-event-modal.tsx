"use client";

import React, { useEffect } from "react";
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
} from "@/components/ui/dialog";
import { FormProvider, FormField } from "@/components/ui/form";
import { Form } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EventFormData, eventSchema, Variant } from "@/types";
import { useScheduler } from "~/providers/scheduler-provider";
import { v4 as uuidv4 } from "uuid";

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
  const { handlers } = useScheduler();
  
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      description: defaultValues?.description || "",
      startDate: defaultValues?.startDate || new Date(),
      endDate: defaultValues?.endDate || new Date(),
      variant: defaultValues?.variant || "primary",
      color: getEventColor(defaultValues?.variant || "primary"),
    },
  });

  const { watch, setValue, handleSubmit, reset } = form;
  const selectedColor = watch("color");

  // Reset form when modal opens/closes or defaultValues change
  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: defaultValues.title || "",
        description: defaultValues.description || "",
        startDate: defaultValues.startDate || new Date(),
        endDate: defaultValues.endDate || new Date(),
        variant: defaultValues.variant || "primary",
        color: getEventColor(defaultValues.variant || "primary"),
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

  function getEventStatus(color: string): Variant {
    switch (color) {
      case "blue":
        return "primary";
      case "red":
        return "danger";
      case "green":
        return "success";
      case "yellow":
        return "warning";
      default:
        return "primary";
    }
  }

  const onSubmit = (formData: EventFormData) => {
    const eventData = {
      id: defaultValues?.id || uuidv4(),
      title: formData.title,
      startDate: formData.startDate,
      endDate: formData.endDate,
      variant: formData.variant,
      description: formData.description,
    };

    if (defaultValues?.id) {
      // Update existing event
      handlers.handleUpdateEvent(eventData, defaultValues.id);
    } else {
      // Add new event
      handlers.handleAddEvent(eventData);
    }
    
    onOpenChange(false);
  };

  const handleDateChange = (field: "startDate" | "endDate", date: Date) => {
    setValue(field, date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {defaultValues?.id ? "Edit Event" : "Add Event"}
          </DialogTitle>
        </DialogHeader>
        
        <FormProvider {...form}>
          <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                name="startDate"
                render={({ field }) => (
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                      onChange={(e) => handleDateChange("startDate", new Date(e.target.value))}
                    />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                      onChange={(e) => handleDateChange("endDate", new Date(e.target.value))}
                    />
                  </div>
                )}
              />
            </div>

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
                        setValue("variant", getEventStatus(color.key));
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