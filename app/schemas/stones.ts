import { z } from "zod";
import { NullableId, StringBoolean } from "./general";

export const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  is_display: StringBoolean,
  on_sale: StringBoolean,

  height: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  supplier_id: NullableId,
  bundle: z.string().optional(),
  cost_per_sqft: z.coerce.number().default(0),
  retail_price: z.coerce.number().default(0),
});
