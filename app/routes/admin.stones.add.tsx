import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  json,
  redirect,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useSubmit, Form, useNavigate, useActionData } from "@remix-run/react";
import { FormProvider, FormField } from "../components/ui/form";
import { validateFormData } from "remix-hook-form";
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
import { SelectInput } from "~/components/molecules/SelectItem";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { FileInput } from "~/components/molecules/FileInput";

function createFromData(data: StoneData) {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("type", data.type);
  formData.append("file", data.file[0]);

  return formData;
}

export const fileUploadHandler =
  (): UploadHandler =>
  async ({ data, filename }) => {
    const chunks = [];
    for await (const chunk of data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    // If there's no filename, it's a text field and we can return the value directly
    if (!filename) {
      const textDecoder = new TextDecoder();
      return textDecoder.decode(buffer);
    }
    // Otherwise, it's a file and we need to return a File object
    return new File([buffer], filename, { type: "image/jpeg" });
  };

const stoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  file: z.any(),
});

type StoneData = z.infer<typeof stoneSchema>;

const resolver = zodResolver(stoneSchema);

export async function action({ request }: ActionFunctionArgs) {
  const formData = await unstable_parseMultipartFormData(
    request,
    fileUploadHandler()
  );
  const { errors, data } = await validateFormData(formData, resolver);
  if (errors) {
    return json({ errors });
  }

  try {
    const result = await db.execute(
      `INSERT INTO main.stones (name, type, url) VALUES (?, ?, ?);`,
      [data.name, data.type, data.file.name]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function StonesAdd() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  console.log(actionData);

  const form = useForm<StoneData>({
    resolver,
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
          <DialogTitle>Add Stone</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <Form
            id="customerForm"
            method="post"
            onSubmit={form.handleSubmit((data) => {
              const formData = createFromData(data);
              submit(formData, {
                method: "post",
                encType: "multipart/form-data",
              });
              (errors) => console.log(errors);
            })}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <InputItem
                  name={"Name"}
                  placeholder={"Name of the stone"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder="Type of the Stone"
                  name="Type"
                  options={[
                    "Granite",
                    "Quartz",
                    "Marble",
                    "Dolomite",
                    "Quartzite",
                  ]}
                />
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FileInput name="Image" id="image" onChange={field.onChange} />
              )}
            />
            <DialogFooter>
              <Button type="submit" form="customerForm">
                Save changes
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
