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
import { TypeSelect } from "~/components/molecules/TypeInput";
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";

const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  is_display: z.boolean(),
  // height: z.coerce.number().optional(),
  // width: z.coerce.number().optional(),
  // amount: z.coerce.number().optional(),
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
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone);
  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";

  // NOTE: THIS IS DANGEROUS
  const stone = await selectId<{ url: string }>(
    db,
    "select url from stones WHERE id = ?",
    stoneId
  );

  try {
    if (newFile) {
      await db.execute(
        `UPDATE main.stones SET name = ?, type = ?, url = ?, is_display = ? WHERE id = ?`,
        [data.name, data.type, data.file, data.is_display, stoneId]
      );
    } else {
      await db.execute(
        `UPDATE main.stones SET name = ?, type = ?, is_display = ? WHERE id = ?`,
        [data.name, data.type, data.is_display, stoneId]
      );
    }
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }

  if (stone?.url && newFile) {
    deleteFile(stone.url);
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
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone);

  const stone = await selectId<{
    name: string;
    type: string;
    url: string;
    is_display: boolean;
    // height: string;
    // width: string;
    // amount: string;
  }>(
    db,
    "select name, type, url, is_display from stones WHERE id = ?",
    stoneId
  );
  return {
    name: stone?.name,
    type: stone?.type,
    url: stone?.url,
    is_display: stone?.is_display,

    // height: stone?.height,
    // width: stone?.width,
    // amount: stone?.amount,
  };
};

export default function StonesEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, type, url, is_display } = useLoaderData<typeof loader>();

  const defaultValues = {
    name,
    type,
    url,
    is_display: is_display,
  };

  const form = useCustomOptionalForm(
    stoneSchema,
    stoneSchema.parse(defaultValues)
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
                type="image"
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="is_display"
            render={({ field }) => <SwitchItem field={field} name=" Display" />}
          />
          <img src={url} alt={name} className="w-48 mt-4 mx-auto" />

          {/* <div className="flex gap-2">
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <InputItem
                  name={"Height"}
                  placeholder={"Height of the stone"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <InputItem
                  name={"Width"}
                  placeholder={"Width of the stone"}
                  field={field}
                />
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <InputItem
                name={"Amount"}
                placeholder={"Amount of the stone"}
                field={field}
              />
            )}
          /> */}

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
