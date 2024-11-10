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

const supplierSchema = z.object({
  website: z.string().url(),
  supplier_name: z.string().min(1),
  manager: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const supplierId = parseInt(params.supplier);
  const { errors, data } = await parseMutliForm(
    request,
    supplierSchema,
    "suppliers"
  );
  if (errors || !data) {
    return json({ errors });
  }

  try {
    await db.execute(
      `UPDATE main.suppliers SET website = ?, supplier_name = ?, manager = ?, phone = ?, email = ?, notes = ?, WHERE id = ?`,
      [
        data.website,
        data.supplier_name,
        data.manager,
        data.phone,
        data.email,
        data.notes,
        supplierId,
      ]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Document Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (params.supplier === undefined) {
    return json({ name: undefined, url: undefined });
  }
  const supplierId = parseInt(params.supplier);

  const supplier = await selectId<{ name: string; url: string }>(
    db,
    "select name, url from suppliers WHERE id = ?",
    supplierId
  );
  return json({
    name: supplier?.name,
    url: supplier?.url,
  });
};

export default function SuppliersEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, url } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(
    supplierSchema,
    supplierSchema.parse({ name, url })
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
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                placeholder={"Name of the supplier"}
                field={field}
              />
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="suppliers"
                id="supplier"
                onChange={field.onChange}
              />
            )}
          />
          <p>{url}</p>
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Edit Document</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
