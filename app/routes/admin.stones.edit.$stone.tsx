import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  useNavigate,
  useLoaderData,
  useNavigation,
  Outlet,
} from "@remix-run/react";
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
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  is_display: z.union([
    z.boolean(),
    z.number().transform((val) => val === 1),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ]),
  height: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
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
        `UPDATE main.stones
         SET name = ?, type = ?, url = ?, is_display = ?, height = ?, width = ?, amount = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.file,
          data.is_display,
          data.height,
          data.width,
          data.amount,
          stoneId,
        ]
      );
    } else {
      await db.execute(
        `UPDATE main.stones
         SET name = ?, type = ?, is_display = ?, height = ?, width = ?, amount = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.is_display,
          data.height,
          data.width,
          data.amount,
          stoneId,
        ]
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
    height: string;
    width: string;
    amount: string;
  }>(
    db,
    "select name, type, url, is_display, height, width, amount from stones WHERE id = ?",
    stoneId
  );
  return {
    name: stone?.name,
    type: stone?.type,
    url: stone?.url,
    is_display: stone?.is_display,

    height: stone?.height,
    width: stone?.width,
    amount: stone?.amount,
  };
};

function StoneInformation({ data }: { data: any }) {
  const navigate = useNavigate();
  const isSubmitting = navigate.state === "submitting";
  const { name, type, url, is_display, height, width, amount } = data;
  const defaultValues = {
    name,
    type,
    url,
    is_display: is_display,
    height,
    width,
    amount,
  };
  const form = useCustomOptionalForm(
    stoneSchema,
    stoneSchema.parse(defaultValues)
  );

  return (
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
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <SelectInput
              field={field}
              placeholder="Type of the Stone"
              name="Type"
              options={["Granite", "Quartz", "Marble", "Dolomite", "Quartzite"]}
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
      </div>
      <FormField
        control={form.control}
        name="is_display"
        render={({ field }) => <SwitchItem field={field} name=" Display" />}
      />
      <img src={url} alt={name} className="w-48 mt-4 mx-auto" />

      <div className="flex gap-2">
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
      />

      <DialogFooter>
        <LoadingButton loading={isSubmitting}>Edit Stone</LoadingButton>
      </DialogFooter>
    </MultiPartForm>
  );
}

export default function StonesEdit() {
  const navigate = useNavigate();
  const data = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Stone</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="information"
          onValueChange={(value) => {
            console.log(value);
            if (value === "images") navigate("images");
          }}
        >
          <TabsList>
            <TabsTrigger value="information">Stone Information</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
          <TabsContent value="information">
            <StoneInformation data={data} />
          </TabsContent>
          <TabsContent value="images">
            <Outlet />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
