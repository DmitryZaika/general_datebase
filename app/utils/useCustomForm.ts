import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { z } from "zod";

const fileSchema = z.object({
  file: z.instanceof(File),
});

export function useCustomForm<T>(schema: T): UseFormReturn<z.infer<T & typeof fileSchema>> {
  const finalSchema = schema.merge(fileSchema);
  type finalData = z.infer<typeof finalSchema>;

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
  });

}