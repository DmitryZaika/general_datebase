import { z } from "zod";
import { NullableId, StringBoolean } from "./general";
import { SINK_TYPES } from "~/utils/constants";

export const sinkSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(SINK_TYPES),
  is_display: StringBoolean,
  
  length: z.coerce.number().nullable().default(null),
  width: z.coerce.number().nullable().default(null),
  amount: z.coerce.number().nullable().default(null),
  company_id: z.number().default(0),
});

export const sinkFilterSchema = z.object({
  type: z.array(z.enum(SINK_TYPES)).default([...SINK_TYPES]),
  show_sold_out: z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    return value === "true";
  }, z.boolean()).default(false),
});

export type SinkFilter = z.infer<typeof sinkFilterSchema>;
