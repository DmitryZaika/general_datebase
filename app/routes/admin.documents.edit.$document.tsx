import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { useNavigate, useLoaderData, useNavigation } from "react-router";
import { FormField } from "../components/ui/form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { selectId } from "~/utils/queryHelpers";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { deleteFile } from "~/utils/s3.server";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";

const documentSchema = z.object({
  name: z.string().min(1),
});

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }
  if (!params.document) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const documentId = parseInt(params.document);
  const { errors, data } = await parseMutliForm(
    request,
    documentSchema,
    "documents",
  );

  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";
  // NOTE: THIS IS DANGEROUS
  const document = await selectId<{ url: string }>(
    db,
    "select url from documents WHERE id = ?",
    documentId,
  );

  try {
    if (newFile) {
      await db.execute(
        `UPDATE main.documents SET name = ?, url = ? WHERE id = ?`,
        [data.name, data.file, documentId],
      );
    } else {
      await db.execute(`UPDATE main.documents SET name = ? WHERE id = ?`, [
        data.name,
        documentId,
      ]);
    }
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }

  if (document?.url && newFile) {
    deleteFile(document.url);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Document Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.document) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const documentId = parseInt(params.document);

  const document = await selectId<{ name: string; url: string }>(
    db,
    "select name, url from documents WHERE id = ?",
    documentId,
  );
  return {
    name: document?.name,
    url: document?.url,
  };
};

export default function DocumentsEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state !== "idle";
  const { name, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    documentSchema,
    documentSchema.parse({ name, url }),
  );
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className=" overflow-auto sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Changes</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the document"}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="documents"
                id="document"
                onChange={field.onChange}
                type="pdf"
              />
            )}
          />
          <p> {url}</p>
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Save Changes</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
