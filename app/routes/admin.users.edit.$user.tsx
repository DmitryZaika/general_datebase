// app/routes/users.$user.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { FormProvider, FormField } from "~/components/ui/form";
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
import { selectId, selectMany } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";

const userschema = z.object({
  name: z.string().min(1),
  phone_number: z.union([z.coerce.string().min(10), z.literal("")]).optional(),
  email: z.union([z.string().email().optional(), z.literal("")]),
  company_id: z.coerce.number(),
  is_admin: z.boolean(),
});

type FormData = z.infer<typeof userschema>;
const resolver = zodResolver(userschema);

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
  if (!params.user) {
    return forceRedirectError(request.headers, "No user id provided");
  }
  const userId = parseInt(params.user);
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }
  await db.execute(
    `
    UPDATE users
    SET
      name = ?,
      email = ?,
      phone_number = ?,
      company_id = ?,
      is_admin = ?
    WHERE id = ?
    `,
    [
      data.name,
      data.email,
      data.phone_number,
      data.company_id,
      data.is_admin,
      userId,
    ]
  );
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "User updated"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

interface Company {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: null | string;
  email: null | string;
  phone_number: null | string;
  company_id: number;
  is_admin: null | number;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.user) {
    return forceRedirectError(request.headers, "No user id provided");
  }
  const userId = parseInt(params.user);
  if (isNaN(userId)) {
    return forceRedirectError(request.headers, "Invalid user id");
  }
  const user = await selectId<User>(
    db,
    "SELECT id, name, email, phone_number, company_id, is_admin FROM users WHERE id = ?",
    userId
  );
  if (!user) {
    return forceRedirectError(request.headers, "Invalid user id");
  }
  const companies = await selectMany<Company>(
    db,
    "SELECT id, name FROM company"
  );
  return {
    user,
    companies: companies.map((c) => ({ key: c.id, value: c.name })),
  };
}

export default function User() {
  const navigate = useNavigate();
  const { user, companies } = useLoaderData<{
    user: User;
    companies: Array<{ key: number; value: string }>;
  }>();
  console.log(companies);
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: user.name || "",
      phone_number: user.phone_number || "",
      email: user.email || "",
      company_id: user.company_id,
      is_admin: user.is_admin === 1,
    },
  });
  console.log(user.company_id);
  const fullSubmit = useFullSubmit(form);
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate("..");
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>User</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form method="post" onSubmit={fullSubmit}>
            <input type="hidden" name="csrf" value={token} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem name="Name" placeholder="Name" field={field} />
              )}
            />
            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <InputItem name="Phone" placeholder="Phone" field={field} />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <InputItem name="Email" placeholder="Email" field={field} />
              )}
            />
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <SelectInput field={field} name="Company" options={companies} />
              )}
            />
            <FormField
              control={form.control}
              name="is_admin"
              render={({ field }) => <SwitchItem field={field} name="Admin" />}
            />
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
