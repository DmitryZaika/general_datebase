import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { z } from "zod";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Form, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getValidatedFormData } from "remix-hook-form";
import { toastData } from "~/utils/toastHelpers";
import { csrf } from "~/utils/csrf.server";
import { login } from "~/utils/session.server";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { commitSession, getSession } from "~/sessions";
import { PasswordInput } from "~/components/molecules/PasswordInput";
import { useFullSubmit } from "~/hooks/useFullSubmit";

const userSchema = z.object({
  email: z.string().email(),
  password: z.coerce.string().min(4),
});
type FormData = z.infer<typeof userSchema>;
const resolver = zodResolver(userSchema);

export async function action({ request }: ActionFunctionArgs) {
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

  const value = await login(data.email, data.password, 60 * 60 * 24 * 7);
  if (value == undefined) {
    return { error: "Unable to login" };
  }

  const session = await getSession(request.headers.get("Cookie"));

  session.set("sessionId", value);

  session.flash("message", toastData("Success", "Logged in"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  return { error };
};

export default function Login() {
  const { error } = useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
  });
  const fullSubmit = useFullSubmit(form, token);

  return (
    <div className="flex justify-center p-20">
      <FormProvider {...form}>
        <Form
          className="w-full max-w-sm bg-white p-6 shadow-md rounded"
          id="customerForm"
          method="post"
          onSubmit={fullSubmit}
        >
          <p className="text-red-500">{error}</p>
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
              <PasswordInput
                name={"Password"}
                placeholder={"Password"}
                field={field}
              />
            )}
          />
          <Button className="ml-auto" type="submit">
            Login
          </Button>
        </Form>
      </FormProvider>
    </div>
  );
}
