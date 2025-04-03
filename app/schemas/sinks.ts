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
  company_id: z.preprocess((value) => {
    if (typeof value === "string") return Number(value);
    return value;
  }, z.number().default(0)),
  supplier_id: z.preprocess((value) => {
    if (typeof value === "string") return Number(value);
    if (value === null || value === undefined) return 0;
    return value;
  }, z.number().gte(0).default(0)),
  retail_price: z.coerce.number().default(0),
  cost: z.coerce.number().default(0),
});

export const sinkFilterSchema = z.object({
  type: z.array(z.enum(SINK_TYPES)).default([...SINK_TYPES]),
  show_sold_out: z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    return value === "true";
  }, z.boolean()).default(false),
  supplier: z.preprocess((value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
    return 0;
  }, z.number().gte(0)).default(0),
});

export type SinkFilter = z.infer<typeof sinkFilterSchema>;
