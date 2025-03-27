import { z } from "zod";
import { NullableId, StringBoolean } from "~/schemas/general";

export const sinkSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum([
    "stainless 18 gauge",
    "stainless 16 gauge",
    "composite",
    "ceramic",
    "farm house",
  ]),
  is_display: StringBoolean,
  length: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  supplier_id: NullableId,
  amount: z.coerce.number().default(0),
});
