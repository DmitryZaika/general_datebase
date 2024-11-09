import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { z } from "zod";

const fileSchema = z.object({
  file: z.instanceof(File),
});

const optionalFileSchema = z.object({
  file: z.instanceof(File).optional(),
});

export function useCustomForm<T>(
  schema: T,
  defaultValues?: object
): UseFormReturn<z.infer<T & typeof fileSchema>> {
  const finalSchema = schema.merge(fileSchema);
  type finalData = z.infer<typeof finalSchema>;

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  });
}

export function useCustomOptionalForm<T>(
  schema: T,
  defaultValues?: object
): UseFormReturn<z.infer<T & typeof optionalFileSchema>> {
  const finalSchema = schema.merge(optionalFileSchema);
  type finalData = z.infer<typeof finalSchema>;

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  });
}
