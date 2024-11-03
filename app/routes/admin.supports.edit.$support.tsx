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
import { selectId } from "~/utils/queryHelpers";
import { toastData } from "~/utils/toastHelpers";

const supportschema = z.object({
  name: z.string().min(1),
});

type FormData = z.infer<typeof supportschema>;

const resolver = zodResolver(supportschema);

export async function action({ request, params }: ActionFunctionArgs) {
  const supportId = params.support;
  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, resolver);
  if (errors) {
    return json({ errors, defaultValues });
  }

  try {
    const result = await db.execute(
      `UPDATE main.supports SET name = ? WHERE id = ?`,
      [data.name, supportId]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "support Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (params.support === undefined) {
    return json({ name: undefined, type: undefined });
  }
  const supportId = parseInt(params.support);

  const support = await selectId<{ name: string; type: string }>(
    db,
    "select name from supports WHERE id = ?",
    supportId
  );
  return json({
    name: support?.name,
    type: support?.type,
  });
};

export default function SupportsEdit() {
  const navigate = useNavigate();
  const { name, type } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const form = useForm<FormData>({
    resolver,
    defaultValues: supportschema.parse({ name, type }),
  });
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit support</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form
            id="customerForm"
            method="post"
            onSubmit={form.handleSubmit(
              (data) => {
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
              name="name"
              render={({ field }) => (
                <InputItem
                  name="Name"
                  placeholder={"Name of the support"}
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
