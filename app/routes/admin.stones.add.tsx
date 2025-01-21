import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { useNavigate, useNavigation } from "@remix-run/react";
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
import { toastData } from "~/utils/toastHelpers";
import { FileInput } from "~/components/molecules/FileInput";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { useCustomForm } from "~/utils/useCustomForm";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { TypeSelect } from "~/components/molecules/TypeInput";

const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  // height: z.coerce.number().optional(),
  // width: z.coerce.number().optional(),
  // amount: z.coerce.number().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
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
  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return { errors };
  }
  let user = await getAdminUser(request);
  try {
    await db.execute(
      `INSERT INTO main.stones (name,type, url, company_id) VALUES (?, ?, ?, ?);`,
      [data.name, data.type, data.file, user.company_id]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);

    const session = await getSession(request.headers.get("Cookie"));
    session.flash(
      "message",
      toastData("Failure", "Database Error Occured", "destructive")
    );
    return new Response(JSON.stringify({ error: "Database Error Occured" }), {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request);
    return { user };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function StonesAdd() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";

  const form = useCustomForm(stoneSchema);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Stone</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name={"Name"}
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
                ].map((item) => ({ key: item.toLowerCase(), value: item }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="stones"
                type="image"
                id="image"
                onChange={field.onChange}
              />
            )}
          />
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
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
