import { z } from "zod";

export const todoListSchema = z.object({
  rich_text: z.string().min(1),
});

export type TTodoListSchema = z.infer<typeof todoListSchema>;
