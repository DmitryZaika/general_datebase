import {
  ActionFunctionArgs,
  json,
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
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { commitSession, getSession } from "~/sessions";

const userSchema = z.object({
  email: z.string().email(),
  password: z.coerce.string(),
});
type FormData = z.infer<typeof userSchema>;
const resolver = zodResolver(userSchema);

export async function action({ request }: ActionFunctionArgs) {
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: error.code };
  }

  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, resolver);
  if (errors) {
    return json({ errors, defaultValues });
  }

  const value = await login(data.email, data.password, 60 * 60 * 24 * 7);
  if (value == undefined) {
    return json({ error: "Unable to login" });
  }

  const session = await getSession(request.headers.get("Cookie"));
  console.log("Value: ", value);
  session.set("userId", value);

  session.flash("message", toastData("Success", "Logged in"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  return json({ error });
};

export default function Login() {
  const submit = useSubmit();
  const { error } = useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
  });

  return (
    <div className="flex justify-center p-20">
      <FormProvider {...form}>
        <p className="text-red-500">{error}</p>
        <Form
          className="w-full max-w-sm bg-white p-6 shadow-md rounded"
          id="customerForm"
          method="post"
          onSubmit={form.handleSubmit(
            (data) => {
              data["csrf"] = token;
              submit(data, {
                method: "post",
                encType: "multipart/form-data",
              });
            },
            (errors) => console.log(errors)
          )}
        >
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
          <Button type="submit">Login</Button>
        </Form>
      </FormProvider>
    </div>
  );
}
