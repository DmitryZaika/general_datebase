import {
    ActionFunctionArgs,
    json,
    LoaderFunctionArgs,
    redirect,
  } from "@remix-run/node";
  import { useNavigate, useLoaderData, useNavigation } from "@remix-run/react";
  import { FormField } from "../components/ui/form";
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
  import { selectId } from "~/utils/queryHelpers";
  import { forceRedirectError, toastData } from "~/utils/toastHelpers";
  import { MultiPartForm } from "~/components/molecules/MultiPartForm";
  import { FileInput } from "~/components/molecules/FileInput";
  import { LoadingButton } from "~/components/molecules/LoadingButton";
  import { parseMutliForm } from "~/utils/parseMultiForm";
  import { useCustomOptionalForm } from "~/utils/useCustomForm";
  import { deleteFile } from "~/utils/s3.server";
  import { getAdminUser } from "~/utils/session.server";
  
  const instructionschema = z.object({
    title: z.string(),
    parent_id: z.union([z.coerce.number().positive(), z.null()]).optional(),
    after_id:  z.union([z.coerce.number().positive(), z.null()]).optional(),
    rich_text: z.string()
  });
  
  export async function action({ request, params }: ActionFunctionArgs) {
    try {
      await getAdminUser(request);
    } catch (error) {
      return redirect(`/login?error=${error}`);
    }
    if (!params.instruction) {
      return forceRedirectError(request.headers, "No instruction id provided");
    }
    const instructionId = parseInt(params.instruction);
    const { errors, data } = await parseMutliForm(request, instructionschema, "instructions");
    if (errors || !data) {
      return { errors };
    }
  
    // NOTE: THIS IS DANGEROUS
    const instruction = await selectId<{ url: string }>(
      db,
      "select url from instructions WHERE id = ?",
      instructionId
    );
    if (instruction?.url) {
      deleteFile(instruction.url);
    }
  
    try {
      let result;
      if (data.file && data.file !== "undefined") {
        result = await db.execute(
          `UPDATE main.instructions SET name = ?, url = ? WHERE id = ?`,
          [data.name, data.file, instructionId]
        );
      } else {
        result = await db.execute(`UPDATE main.instructions SET name = ? WHERE id = ?`, [
          data.name,
          instructionId,
        ]);
      }
  
      console.log(result);
    } catch (error) {
      console.error("Error connecting to the database: ", errors);
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "instruction Edited"));
    return redirect("..", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
  
  export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    try {
      await getAdminUser(request);
    } catch (error) {
      return redirect(`/login?error=${error}`);
    }
    if (!params.instruction) {
      return forceRedirectError(request.headers, "No document id provided");
    }
    const instructionId = parseInt(params.instruction);
  
    const instruction = await selectId<{ name: string; url: string }>(
      db,
      "select name, url from instructions WHERE id = ?",
      instructionId
    );
    return {
      name: instruction?.name,
      url: instruction?.url,
    };
  };
  
  export default function instructionsEdit() {
    const navigate = useNavigate();
    const isSubmitting = useNavigation().state === "submitting";
    const { name, url } = useLoaderData<typeof loader>();
  
    const form = useCustomOptionalForm(
      instructionschema,
      instructionschema.parse({ name, url })
    );
    const handleChange = (open: boolean) => {
      if (open === false) {
        navigate("..");
      }
    };
  
    return (
      <Dialog open={true} onOpenChange={handleChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit instruction</DialogTitle>
          </DialogHeader>
          <MultiPartForm form={form}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem
                  name="Name"
                  placeholder={"Name of the instruction"}
                  field={field}
                />
              )}
            />
  
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FileInput
                  inputName="instructions"
                  id="image"
                  onChange={field.onChange}
                />
              )}
            />
            <p>{url}</p>
            <DialogFooter>
              <LoadingButton loading={isSubmitting}>Edit instruction</LoadingButton>
            </DialogFooter>
          </MultiPartForm>
        </DialogContent>
      </Dialog>
    );
  }
  