import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn, FieldValues } from "react-hook-form";
import { z } from "zod";

const fileSchema = z.object({
  file: z.instanceof(Blob),
});

const optionalFileSchema = z.object({
  file: z.instanceof(Blob).optional(),
});

export function useCustomForm<TFieldValues extends FieldValues = FieldValues>(
  schema: TFieldValues,
  defaultValues?: object
): UseFormReturn<z.infer<TFieldValues & typeof fileSchema>> {
  const finalSchema = schema.merge(fileSchema);
  type finalData = z.infer<typeof finalSchema>;

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  });
}

export function useCustomOptionalForm<TFieldValues extends FieldValues = FieldValues>(
  schema: TFieldValues,
  defaultValues?: object
): UseFormReturn<z.infer<TFieldValues & typeof optionalFileSchema>> {
  const finalSchema = schema.merge(optionalFileSchema);
  type finalData = z.infer<typeof finalSchema>;

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  });
}
