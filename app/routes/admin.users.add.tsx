import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
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
import { useAuthenticityToken } from "remix-utils/csrf/react";

import { csrf } from "~/utils/csrf.server";
import { getSuperUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";
import bcrypt from "bcryptjs";
import { SwitchItem } from "~/components/molecules/SwitchItem";

interface Company {
  id: number;
  name: string;
}

const userschema = z.object({
  name: z.string().min(1),
  phone_number: z.union([z.coerce.string().min(10), z.literal("")]).optional(),
  email: z.union([z.string().email().optional(), z.literal("")]),
  password: z.coerce.string().min(4),
  company_id: z.coerce.number(),
  is_employee: z.boolean(),
  is_admin: z.boolean(),
});

type FormData = z.infer<typeof userschema>;
const resolver = zodResolver(userschema);

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }
  const password = await bcrypt.hash(data.password, 10);
  try {
    await db.execute(
      `INSERT INTO main.users (name, phone_number, email, password, company_id, is_employee, is_admin)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        data.name,
        data.phone_number,
        data.email,
        password,
        data.company_id,
        data.is_admin,
      ]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "user added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const companies = await selectMany<Company>(
    db,
    "select id, name from company"
  );
  return { companies };
};

export default function UsersAdd() {
  const navigate = useNavigate();
  const { companies } = useLoaderData<typeof loader>();
  const cleanCompanies = companies.map((company) => ({
    key: company.id,
    value: company.name,
  }));
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: "",
      phone_number: "",
      email: "",
      password: "",
      company_id: 0,
      is_employee: false,
      is_admin: false,
    },
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
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem
                  name={"User Name"}
                  placeholder={"Name"}
                  field={field}
                />
              )}
            />

            <FormField
              control={form.control}
              name="phone_number"
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
              name="password"
              render={({ field }) => (
                <InputItem
                  name={"Password"}
                  placeholder={"Password"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  name="Company"
                  options={cleanCompanies}
                />
              )}
            />
            <FormField
              control={form.control}
              name="is_admin"
              render={({ field }) => (
                <SwitchItem field={field} name="  Admin" />
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
