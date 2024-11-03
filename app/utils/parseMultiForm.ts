import { validateFormData } from "remix-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  unstable_parseMultipartFormData,
  UploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_composeUploadHandlers,
} from "@remix-run/node";
import { s3UploadHandler } from "~/utils/s3.server";

const fileSchema = z.object({
  file: z.string(),
});

export async function parseMutliForm<T>(request: Request, schema: T) {
  const finalSchema = schema.merge(fileSchema);
  const resolver = zodResolver(finalSchema);

  const uploadHandler: UploadHandler = unstable_composeUploadHandlers(
    s3UploadHandler,
    unstable_createMemoryUploadHandler()
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );
  return await validateFormData(formData, resolver);
}
