import { z } from "zod";

export const eventSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().optional(),
  start_date: z.date(),
  end_date: z.date(),
  all_day: z.boolean().default(false),
  color: z.string().max(50, "Color must be 50 characters or less").default("primary"),
  status: z.string().max(50, "Status must be 50 characters or less").default("scheduled"),
  notes: z.string().optional(),
  assigned_user_id: z.number().optional(),
  sale_id: z.number().optional(),
}).refine((data) => data.end_date >= data.start_date, {
  message: "End date must be after start date",
  path: ["end_date"],
});

export type EventFormData = z.infer<typeof eventSchema>;

export const eventUpdateSchema = z.object({
  id: z.number(),
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().optional(),
  start_date: z.date(),
  end_date: z.date(),
  all_day: z.boolean().default(false),
  color: z.string().max(50, "Color must be 50 characters or less").default("primary"),
  status: z.string().max(50, "Status must be 50 characters or less").default("scheduled"),
  notes: z.string().optional(),
  assigned_user_id: z.number().optional(),
  sale_id: z.number().optional(),
}).refine((data) => data.end_date >= data.start_date, {
  message: "End date must be after start date",
  path: ["end_date"],
});

export type EventUpdateData = z.infer<typeof eventUpdateSchema>; 