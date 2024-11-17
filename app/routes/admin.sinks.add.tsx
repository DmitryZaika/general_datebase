import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  ActionFunctionArgs,
  json,
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
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { FileInput } from "~/components/molecules/FileInput";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { useCustomForm } from "~/utils/useCustomForm";
import { getAdminUser } from "~/utils/session.server";

const sinkSchema = z.object({
  name: z.string().min(1),
});

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const { errors, data } = await parseMutliForm(request, sinkSchema, "sinks");
  if (errors || !data) {
    return json({ errors });
  }

  try {
    await db.execute(`INSERT INTO main.sinks (name, url) VALUES (?,  ?);`, [
      data.name,
      data.file,
    ]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));
  console.log("HERE 2");
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request);
    return json({ user });
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SinksAdd() {
  const navigate = useNavigate();
  // const actionData = useActionData<typeof action>();
  const isSubmitting = useNavigation().state === "submitting";

  const form = useCustomForm(sinkSchema);
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
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>

        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name={"Name"}
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
