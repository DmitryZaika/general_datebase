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
import { toastData } from "~/utils/toastHelpers";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { deleteFile } from "~/utils/s3.server";
import { getAdminUser } from "~/utils/session.server";

const imageSchema = z.object({
  name: z.string().min(1),
});

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const imageId = parseInt(params.image);
  const { errors, data } = await parseMutliForm(request, imageSchema, "images");
  if (errors || !data) {
    return json({ errors });
  }

  // NOTE: THIS IS DANGEROUS
  const image = await selectId<{ url: string }>(
    db,
    "select url from images WHERE id = ?",
    imageId
  );
  deleteFile(image.url);

  try {
    let result;
    console.log(typeof data.file);

    if (data.file && data.file !== "undefined") {
      result = await db.execute(
        `UPDATE main.images SET name = ?, url = ? WHERE id = ?`,
        [data.name, data.file, imageId]
      );
    } else {
      result = await db.execute(
        `UPDATE main.images SET name = ? WHERE id = ?`,
        [data.name, imageId]
      );
    }

    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Image Edited"));
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
  if (params.image === undefined) {
    return json({ name: undefined, url: undefined });
  }
  const imageId = parseInt(params.image);

  const image = await selectId<{ name: string; url: string }>(
    db,
    "select name, url from images WHERE id = ?",
    imageId
  );
  return json({
    name: image?.name,
    url: image?.url,
  });
};

export default function ImagesEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    imageSchema,
    imageSchema.parse({ name, url })
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
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the image"}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="images"
                id="image"
                onChange={field.onChange}
              />
            )}
          />
          <p>{url}</p>
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Image</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
