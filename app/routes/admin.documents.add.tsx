import { LoadingButton } from "~/components/molecules/LoadingButton";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { useNavigate, useNavigation } from "react-router";
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
import { csrf } from "~/utils/csrf.server";

const documentSchema = z.object({
  name: z.string().min(1),
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

  const { errors, data } = await parseMutliForm(
    request,
    documentSchema,
    "documents",
  );
  if (errors || !data) {
    return { errors };
  }
  let user = await getAdminUser(request);
  try {
    await db.execute(
      `INSERT INTO main.documents (name, url, company_id) VALUES (?,  ?, ?);`,
      [data.name, data.file, user.company_id],
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Document added"));
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

export default function DocumentsAdd() {
  const navigate = useNavigate();
  // const actionData = useActionData<typeof action>();
  const isSubmitting = useNavigation().state !== "idle";
  const form = useCustomForm(documentSchema);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>

        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name={"Name"}
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
                label="Document"
                inputName="documents"
                id="document"
                type="pdf"
                onChange={field.onChange}
              />
            )}
          />
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Document</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
