import {
  ActionFunctionArgs,
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
import { SelectInput } from "~/components/molecules/SelectItem";
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

const stoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
});

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone);
  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return { errors };
  }

  // NOTE: THIS IS DANGEROUS
  const stone = await selectId<{ url: string }>(
    db,
    "select url from stones WHERE id = ?",
    stoneId
  );
  if (stone?.url) {
    deleteFile(stone.url);
  }

  try {
    if (data.file && data.file !== "undefined") {
      await db.execute(
        `UPDATE main.stones SET name = ?, type = ?, url = ? WHERE id = ?`,
        [data.name, data.type, data.file, stoneId]
      );
    } else {
      await db.execute(
        `UPDATE main.stones SET name = ?, type = ? WHERE id = ?`,
        [data.name, data.type, stoneId]
      );
    }
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone Edited"));
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
  if (!params.stone) {
    return forceRedirectError(request.headers, "No image id provided");
  }
  const stoneId = parseInt(params.stone);

  const stone = await selectId<{ name: string; type: string; url: string }>(
    db,
    "select name, type, url from stones WHERE id = ?",
    stoneId
  );
  return {
    name: stone?.name,
    type: stone?.type,
    url: stone?.url,
  };
};

export default function StonesEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, type, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    stoneSchema,
    stoneSchema.parse({ name, type, url })
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
          <DialogTitle>Edit Stone</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the stone"}
                field={field}
              />
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <SelectInput
                field={field}
                placeholder="Type of the Stone"
                name="Type"
                options={[
                  "Granite",
                  "Quartz",
                  "Marble",
                  "Dolomite",
                  "Quartzite",
                ]}
              />
            )}
          />
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="stones"
                id="image"
                onChange={field.onChange}
              />
            )}
          />
          <p>{url}</p>
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
