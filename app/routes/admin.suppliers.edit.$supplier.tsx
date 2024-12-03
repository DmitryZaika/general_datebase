import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { useSubmit, Form, useNavigate, useLoaderData } from "@remix-run/react";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { selectId } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";

const supplierschema = z.object({
  website: z.string().url(),
  supplier_name: z.string().min(1),
  manager: z.string().optional(),
  phone: z.union([z.coerce.string().min(10), z.literal("")]),
  email: z.union([z.string().email().optional(), z.literal("")]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof supplierschema>;

const resolver = zodResolver(supplierschema);

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: error.code };
  }
  if (!params.supplier) {
    return forceRedirectError(request.headers, "No supplier id provided");
  }
  const supplierId = parseInt(params.supplier);

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }

  await db.execute(
    `UPDATE main.suppliers SET website = ?, supplier_name = ?, manager = ?, phone= ?, email = ?, notes= ? WHERE id = ?`,
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

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Error", "supplier added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

interface Supplier {
  website: string;
  supplier_name: string;
  manager: string;
  email: string;
  phone: string;
  notes: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.supplier) {
    return forceRedirectError(request.headers, "No image id provided");
  }

  const supplierId = parseInt(params.supplier);

  if (isNaN(supplierId)) {
    return forceRedirectError(request.headers, "Invalid supplier id");
  }

  const supplier = await selectId<Supplier>(
    db,
    "select website, supplier_name, manager, phone, email, notes from suppliers WHERE id = ?",
    supplierId
  );

  if (!supplier) {
    return forceRedirectError(request.headers, "Invalid supplier id");
  }
  const { website, supplier_name, manager, email, phone, notes } = supplier;
  return {
    website,
    supplier_name,
    manager,
    email,
    phone,
    notes,
  };
};

export default function SuppliersAdd() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const { website, supplier_name, manager, email, phone, notes } =
    useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      website,
      supplier_name,
      manager,
      phone,
      email,
      notes,
    },
  });
  const fullSubmit = useFullSubmit(form, token);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <InputItem
                  name={"Website"}
                  placeholder={"Website"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <InputItem
                  name={"Supplier Name"}
                  placeholder={"Name of the supplier"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="manager"
              render={({ field }) => (
                <InputItem
                  name={"Manager"}
                  placeholder={"Name of the manager"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <InputItem
                  name={"Phone Number"}
                  placeholder={"Phone Number"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <InputItem name={"Email"} placeholder={"Email"} field={field} />
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <InputItem name={"Notes"} placeholder={"Notes"} field={field} />
              )}
            />
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
