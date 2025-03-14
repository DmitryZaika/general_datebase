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

const sinkSchema = z.object({
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
  if (!params.sink) {
    return forceRedirectError(request.headers, "No Sink id provided");
  }
  const sinkId = parseInt(params.sink);
  const { errors, data } = await parseMutliForm(request, sinkSchema, "sinks");
  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";

  // NOTE: THIS IS DANGEROUS
  const sink = await selectId<{ url: string }>(
    db,
    "select url from sinks WHERE id = ?",
    sinkId
  );

  try {
    let result;
    if (newFile) {
      result = await db.execute(
        `UPDATE main.sinks SET name = ?, url = ? WHERE id = ?`,
        [data.name, data.file, sinkId]
      );
    } else {
      result = await db.execute(`UPDATE main.sinks SET name = ? WHERE id = ?`, [
        data.name,
        sinkId,
      ]);
    }
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  if (sink?.url && newFile) {
    deleteFile(sink.url);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink Edited"));
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
  if (!params.sink) {
    return forceRedirectError(request.headers, "No Sink id provided");
  }
  const sinkId = parseInt(params.sink);

  const sink = await selectId<{ name: string; url: string }>(
    db,
    "select name, url from sinks WHERE id = ?",
    sinkId
  );
  return {
    name: sink?.name,
    url: sink?.url,
  };
};

export default function SinksEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    sinkSchema,
    sinkSchema.parse({ name, url })
  );
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Sink</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the sink"}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="sinks"
                id="image"
                onChange={field.onChange}
                type="image"
              />
            )}
          />
          <img src={url} alt={name} className="w-48 mt-4 mx-auto" />
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Sink</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
