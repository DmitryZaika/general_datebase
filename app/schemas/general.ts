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
