import { z } from "zod";

export const todoListSchema = z.object({
  rich_text: z.string().min(1),
});

export type TTodoListSchema = z.infer<typeof todoListSchema>;

export const NullableId = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return null;
  const num = parseInt(val as string, 10);
  return isNaN(num) ? null : num;
}, z.number().nullable());

export const StringBoolean = z.union([
  z.boolean(),
  z.number().transform((val) => val === 1),
  z.enum(["true", "false"]).transform((val) => val === "true"),
]);

export const StringOrNumber = z.union([z.string(), z.number(), z.null()])
.transform(val => val ? String(val) : "")
.optional();

export const coerceNumber = z.coerce.number().default(0)
export const coerceNumberRequired = z.coerce.number().min(1)
export const StringBoolV2 = z.preprocess((val) => {
  if (val === undefined) {
    return undefined;
  }
  if (val === "true") {
    return true;
  }
}, z.boolean().optional());
