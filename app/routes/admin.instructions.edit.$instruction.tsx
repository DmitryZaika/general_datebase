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
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { SelectInput } from "~/components/molecules/SelectItem";
import { afterOptions, parentOptions } from "~/utils/instructionsHelpers";

const instructionSchema = z.object({
  title: z.string().min(1),
  parent_id: z.coerce.number(),
  after_id: z.coerce.number(),
  rich_text: z.string().min(1),
});

type FormData = z.infer<typeof instructionSchema>;

const resolver = zodResolver(instructionSchema);

export async function action({ request, params }: ActionFunctionArgs) {
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

  if (!params.instruction) {
    return forceRedirectError(request.headers, "No Instruction id provided");
  }
  const instructionId = parseInt(params.instruction);

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }

  try {
    await db.execute(
      `UPDATE main.instructions SET title = ?, parent_id = ?, after_id = ?, rich_text = ? WHERE id = ?;`,
      [
        data.title,
        data.parent_id || null,
        data.after_id || null,
        data.rich_text,
        instructionId,
      ]
    );
  } catch (error) {
    console.error("Error updating the database: ", error);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Instruction updated"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

interface Instruction {
  id: number;
  title: string;
  parent_id: number;
  after_id: number;
  rich_text: string;
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  if (!params.instruction) {
    return forceRedirectError(request.headers, "No instruction id provided");
  }
  const instructionId = parseInt(params.instruction);

  if (isNaN(instructionId)) {
    return forceRedirectError(request.headers, "Invalid instruction id");
  }

  const instruction = await selectId<Instruction>(
    db,
    "SELECT title, parent_id, after_id, rich_text FROM instructions WHERE id = ?",
    instructionId
  );

  const instructions = await selectMany<{
    title: string;
    id: number;
    parent_id: number;
  }>(db, "SELECT id, parent_id, title FROM instructions");

  if (!instruction) {
    return forceRedirectError(request.headers, "Invalid supplier id");
  }
  const { title, parent_id, after_id, rich_text } = instruction;
  return {
    title,
    parent_id,
    after_id,
    rich_text,
    instructions,
  };
};

export default function InstructionsEdit() {
  const navigate = useNavigate();
  const { title, parent_id, after_id, rich_text } =
    useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const { instructions } = useLoaderData<typeof loader>();
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      title,
      parent_id: parent_id || 0,
      after_id: after_id || 0,
      rich_text,
    },
  });

  const parentValues = parentOptions(instructions);
  const afterValues = afterOptions(parent_id, instructions);
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
          <DialogTitle>Edit Instruction</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <InputItem name={"Title"} placeholder={"Title"} field={field} />
              )}
            />
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  disabled={true}
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
                  disabled={true}
                  options={afterValues}
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
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
