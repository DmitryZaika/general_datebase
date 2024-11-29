import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { useNavigate, useNavigation, Form, useSubmit, useLoaderData } from "@remix-run/react";
import { FormField, FormProvider } from "../components/ui/form";
import { useFullSubmit } from "~/hooks/useFullSubmit";

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
import { InstructionsBasic,parentOptions, afterOptions } from "~/utils/instructionsHelpers";


const instructionschema = z.object({
  title: z.string(),
  parent_id: z.union([z.coerce.number(),z.null()]).optional(),
  after_id:  z.union([z.coerce.number().positive(), z.null()]).optional(),
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
    return { errors, receivedValues };
  }


  let  insertId : null | number = null 
  try {
    const result = await db.execute(`INSERT INTO main.instructions (title, parent_id, after_id, rich_text) VALUES (?,  ?, ?, ?);`, [
      data.title,
      data.parent_id || null, data.after_id, data.rich_text
    ]);
    insertId =  result[0].insertId
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }

  try {
    const result = await db.execute(`UPDATE main.instructions SET after_id = ? WHERE after_id = ? AND id != ?;`, [
     insertId,
   data.after_id,
  insertId
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
  const instructions = await selectMany<InstructionsBasic>(
    db,
    "SELECT id, parent_id, title FROM instructions"
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
  const { instructions } = useLoaderData<typeof loader>();



  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      title: "",
      rich_text: "",
   
    },
  });
 
  
  const parent_id = form.getValues("parent_id")
  const parentValues =  parentOptions(instructions)  
  const afterValues = afterOptions(parent_id, instructions)
console.log(parentValues);


  const fullSubmit = useFullSubmit(form, token);

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
            onSubmit={fullSubmit}
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
      <FormField
            control={form.control}
            name="parent_id"
            render={({ field }) => (
              <SelectInput
                field={field}
                disabled={parentValues.length===0}
                name="Parent"
                options={parentValues}
              />
            )}
          />
       <FormField
            control={form.control}
            name="after_id"
            render={({ field }) => (
              <SelectInput
                field={field}
                name="After"
                disabled={afterValues.length===0}
                options={
                afterValues
                }
              />
            )}
          />
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
