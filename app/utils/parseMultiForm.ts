import { validateFormData } from "remix-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldErrors, FieldValues } from "react-hook-form";
import { z } from "zod";
import {
  unstable_parseMultipartFormData,
  UploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_composeUploadHandlers,
} from "@remix-run/node";
import { s3UploadHandler } from "~/utils/s3.server";
import { csrf } from "~/utils/csrf.server";

const fileSchema = z.object({
  file: z.string(),
});
interface ValidatedData<T> {
  data: z.infer<T & typeof fileSchema> | undefined;
  errors: FieldErrors<FieldValues> | undefined;
}

export async function parseMutliForm<T>(
  request: Request,
  schema: T,
  folder: string
): Promise<ValidatedData<T>> {
  const finalSchema = schema.merge(fileSchema);
  const resolver = zodResolver(finalSchema);

  const uploadHandler: UploadHandler = unstable_composeUploadHandlers(
    (value) => s3UploadHandler(value, folder),
    unstable_createMemoryUploadHandler()
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );
  csrf.validate(formData, request.headers);
  const { data, errors } = await validateFormData(formData, resolver);
  return { data, errors };
}
