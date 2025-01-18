import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { getSession, commitSession } from "~/sessions";
import { z } from "zod";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Form, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getValidatedFormData } from "remix-hook-form";
import { toastData } from "~/utils/toastHelpers";
import { csrf } from "~/utils/csrf.server";
import { getSuperUser, register } from "~/utils/session.server";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useFullSubmit } from "~/hooks/useFullSubmit";

const userSchema = z.object({
  email: z.string().email(),
  password: z.coerce.string(),
  company_id: z.number(),
});
type FormData = z.infer<typeof userSchema>;
const resolver = zodResolver(userSchema);

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

  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, resolver);
  if (errors) {
    return { errors, defaultValues };
  }

  try {
    const value = await register(data.email, data.password, data.company_id);
  } catch (error) {
    console.error(error);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Logged in"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Login() {
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
  });
  const fullSubmit = useFullSubmit(form);

  return (
    <FormProvider {...form}>
      <Form id="customerForm" method="post" onSubmit={fullSubmit}>
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
            <InputItem name={"Company"} placeholder={"Company"} field={field} />
          )}
        />
        <FormField
          control={form.control}
          name=""
          render={({ field }) => (
            <InputItem name={"Company"} placeholder={"Company"} field={field} />
          )}
        />
        <Button type="submit">Add user</Button>
      </Form>
    </FormProvider>
  );
}
