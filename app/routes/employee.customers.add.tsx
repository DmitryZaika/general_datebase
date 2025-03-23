import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { Form, useNavigate } from "react-router";
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
import { toastData } from "~/utils/toastHelpers";
import { getAdminUser, getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.union([z.coerce.string().min(10), z.literal("")]),
  address: z.string().min(10).optional(),
});

type FormData = z.infer<typeof customerSchema>;

const resolver = zodResolver(customerSchema);

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data } = await getValidatedFormData<FormData>(
    request,
    resolver,
  );
  if (errors) {
    return { errors };
  }

  try {
    await db.execute(
      `INSERT INTO main.customers (name, email, phone, address ) VALUES (?,?,?,?)`,
      [data.name, data.email, data.phone, data.address],
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
    return { error: "Database error" };
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Customer added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    return { user };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function CustomersAdd() {
  const navigate = useNavigate();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
  });
  const fullSubmit = useFullSubmit(form);
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem
                  name={"Name"}
                  placeholder={"Name of the customer"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <InputItem
                  name={"Email"}
                  placeholder={"Customer's email"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <InputItem
                  name={"Phone"}
                  placeholder={"Customer's phone number"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <InputItem
                  name={"Address"}
                  placeholder={"Customer's address"}
                  field={field}
                />
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
