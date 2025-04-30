import { z } from "zod";
import { NullableId, StringBoolean } from "./general";
import { STONE_TYPES } from "~/utils/constants";

export const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(STONE_TYPES),
  is_display: StringBoolean,
  on_sale: StringBoolean,
  length: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  supplier_id: NullableId,
  bundle: z.string().optional(),
  cost_per_sqft: z.coerce.number().default(0),
  retail_price: z.coerce.number().default(0),
  level: NullableId,
  colors: z.any().optional(),
});

export const stoneFilterSchema = z.object({
  type: z.array(z.enum(STONE_TYPES)).default([]),
  show_sold_out: z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    return value === "true";
  }, z.boolean()).default(false),
  supplier: z.number().gte(0).default(0),
  colors: z.any().optional(),
  level: z.array(z.number()).default([])
});
export type StoneFilter = z.infer<typeof stoneFilterSchema>;
