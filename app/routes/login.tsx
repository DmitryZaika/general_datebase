import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { z } from "zod";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { getValidatedFormData } from "remix-hook-form";
import { useForm, FormProvider } from "react-hook-form";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser, login } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { PasswordInput } from "~/components/molecules/PasswordInput";
import { DialogFooter } from "~/components/ui/dialog";
import { LoadingButton } from "~/components/molecules/LoadingButton";

const userSchema = z.object({
  email: z.string().email(),
  password: z.coerce.string().min(4),
});

type FormData = z.infer<typeof userSchema>;

interface ActionData {
  error?: string;
  errors?: Record<string, any>;
  defaultValues?: Partial<FormData>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
    return redirect("/employee");
  } catch {}
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  return { error };
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    await csrf.validate(request);
  } catch (e) {
    return { error: String(e) } as ActionData;
  }
  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, zodResolver(userSchema));
  if (errors) {
    return { errors, defaultValues } as ActionData;
  }

  const sessionId = await login(data.email, data.password, 60 * 60 * 24 * 7);
  if (!sessionId) {
    return { error: "Unable to login", defaultValues } as ActionData;
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.set("sessionId", sessionId);
  session.flash("message", toastData("Success", "Logged in"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Login() {
  const navigation = useNavigation();
  const { error } = useLoaderData<{ error: string | null }>();
  const actionData = useActionData<ActionData>();
  const form = useForm<FormData>({
    resolver: zodResolver(userSchema),
    defaultValues: actionData?.defaultValues || { email: "", password: "" },
  });
  const fullSubmit = useFullSubmit(form);
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="flex justify-center p-20">
      <FormProvider {...form}>
        <Form
          className="w-full max-w-sm bg-white p-6 shadow-md rounded"
          method="post"
          onSubmit={fullSubmit}
        >
          <p className="text-red-500">{error || actionData?.error || ""}</p>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <InputItem name="Email" placeholder="Email" field={field} />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <PasswordInput
                name="password"
                placeholder="Password"
                field={field}
              />
            )}
          />
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Login</LoadingButton>
          </DialogFooter>
        </Form>
      </FormProvider>
    </div>
  );
}
