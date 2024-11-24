import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { useNavigate, useNavigation, Form, useSubmit, useLoaderData } from "@remix-run/react";
import { FormField, FormProvider } from "../components/ui/form";

import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import {  toastData } from "~/utils/toastHelpers";
import { getAdminUser } from "~/utils/session.server";
import { getValidatedFormData } from "remix-hook-form";
import { csrf } from "~/utils/csrf.server";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";

const instructionschema = z.object({
  title: z.string(),
  parent_id: z.coerce.number().optional(),
  place: z.coerce.number().optional(),
  rich_text: z.string()
});

type FormData = z.infer<typeof instructionschema>;

const resolver = zodResolver(instructionschema);

export async function action({ request }: ActionFunctionArgs) {
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
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return json({ errors, receivedValues });
  }

  try {
    await db.execute(`INSERT INTO main.instructions (title, parent_id, place, rich_text) VALUES (?,  ?, ?, ?);`, [
      data.title,
      data.parent_id, data.place, data.rich_text
    ]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));

  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request}: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const instructions = await selectMany<{ title: string; parent_id: number }>(
    db,
    "SELECT parent_id, title FROM instructions"
  );

  if (!instructions) {
    return { instructions: [] }; 
  }

  return { instructions };
};




export default function InstructionsAdd() {

  
  const navigate = useNavigate();
  // const actionData = useActionData<typeof action>();
  const isSubmitting = useNavigation().state === "submitting";
  const token = useAuthenticityToken();
  const submit = useSubmit();
  const { instructions } = useLoaderData<typeof loader>();

  const instructionsOptions: { key: string; value: string }[] = instructions.map(
    (instruction) => ({
      key: instruction.parent_id.toString(),
      value: instruction.title,
    })
  );

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      title: "",
      rich_text: "",
   
    },
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
          <DialogTitle>Add instruction</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form
            id="customerForm"
            method="post"
            onSubmit={form.handleSubmit(
              (data) => {
                console.log(data)
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
            name="title"
            render={({ field }) => (
              <InputItem
                name={"Title"}
                placeholder={"Name of the instruction"}
                field={field}
              />
            )}
          />
      {  instructions ? ( <FormField
            control={form.control}
            name="parent_id"
            render={({ field }) => (
              <SelectInput
                field={field}
                placeholder="Parent"
                name="Parent"
                options={instructionsOptions}
              />
            )}
          />): null}
         {instructions ? (<FormField
            control={form.control}
            name="place"
            render={({ field }) => (
              <SelectInput
                field={field}
                placeholder="Order"
                name="Order"
                options={
                instructionsOptions
                }
              />
            )}
          />) : null}
          <FormField
            control={form.control}
            name="rich_text"
            render={({ field }) => (
              <InputItem
                name={"Text"}
                placeholder={"Name of the instruction"}
                field={field}
              />
            )}
          />
        
          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Instruciton</LoadingButton>
          </DialogFooter>
        </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
