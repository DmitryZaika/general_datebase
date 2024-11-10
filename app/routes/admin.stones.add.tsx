import { LoadingButton } from "~/components/molecules/LoadingButton";
import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
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
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

const stoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
});

export async function action({ request }: ActionFunctionArgs) {
  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return json({ errors });
  }
  try {
    await db.execute(
      `INSERT INTO main.stones (name, type, url) VALUES (?, ?, ?);`,
      [data.name, data.type, data.file]
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

export default function StonesAdd() {
  const navigate = useNavigate();
  // const actionData = useActionData<typeof action>();
  const isSubmitting = useNavigation().state === "submitting";

  const form = useCustomForm(stoneSchema);
  console.log(form.formState.errors);

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
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
