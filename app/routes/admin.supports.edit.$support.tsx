import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { useNavigate, useLoaderData, useNavigation } from "@remix-run/react";
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

const supportSchema = z.object({
  name: z.string().min(1),
});

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.support) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const supportId = parseInt(params.support);
  const { errors, data } = await parseMutliForm(
    request,
    supportSchema,
    "supports"
  );
  if (errors || !data) {
    return json({ errors });
  }

  // NOTE: THIS IS DANGEROUS
  const support = await selectId<{ url: string }>(
    db,
    "select url from supports WHERE id = ?",
    supportId
  );
  if (support?.url) {
    deleteFile(support.url);
  }

  try {
    let result;
    console.log(typeof data.file);

    if (data.file && data.file !== "undefined") {
      result = await db.execute(
        `UPDATE main.supports SET name = ?, url = ? WHERE id = ?`,
        [data.name, data.file, supportId]
      );
    } else {
      result = await db.execute(
        `UPDATE main.supports SET name = ? WHERE id = ?`,
        [data.name, supportId]
      );
    }

    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Support Edited"));
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
  if (!params.support) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const supportId = parseInt(params.support);

  const support = await selectId<{ name: string; url: string }>(
    db,
    "select name, url from supports WHERE id = ?",
    supportId
  );
  return json({
    name: support?.name,
    url: support?.url,
  });
};

export default function SupportsEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    supportSchema,
    supportSchema.parse({ name, url })
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
          <DialogTitle>Edit Support</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the support"}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="supports"
                id="image"
                onChange={field.onChange}
              />
            )}
          />
          <p>{url}</p>
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Support</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
