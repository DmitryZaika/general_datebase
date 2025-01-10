import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Form, useNavigate, useLoaderData } from "@remix-run/react";
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

const userschema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.union([z.string().email(), z.literal("")]),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone_number: z.union([z.coerce.string().min(10), z.literal("")]).optional(),
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
    `UPDATE main.users SET name = ?, email = ?, phone_number= ? WHERE id = ?`,
    [data.name, data.email, data.phone_number, userId]
  );

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Error", "user added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

interface User {
  name: string;
  email: string;
  phone_number: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.user) {
    return forceRedirectError(request.headers, "No image id provided");
  }

  const userId = parseInt(params.user);

  if (isNaN(userId)) {
    return forceRedirectError(request.headers, "Invalid user id");
  }

  const user = await selectId<User>(
    db,
    "select name, email, phone_number from users WHERE id = ?",
    userId
  );

  if (!user) {
    return forceRedirectError(request.headers, "Invalid user id");
  }
  const { name, email, phone_number } = user;
  return {
    name,
    email,
    phone_number,
  };
};

export default function UsersAdd() {
  const navigate = useNavigate();
  const { name, email, phone_number } = useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: name || "",
      email: email || "",
      phone_number: phone_number || "",
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
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem name={"Name"} placeholder={"Name"} field={field} />
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
              name="phone_number"
              render={({ field }) => (
                <InputItem
                  name={"Phone Number"}
                  placeholder={"Phone Number"}
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
