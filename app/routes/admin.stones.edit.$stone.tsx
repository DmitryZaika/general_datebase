import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  useSubmit,
  Form,
  useNavigate,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";

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
import { selectId } from "~/utils/queryHelpers";
import { toastData } from "~/utils/toastHelpers";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";

const stoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  file: z.any(),
});

type FormData = z.infer<typeof stoneSchema>;

const resolver = zodResolver(stoneSchema);

export async function action({ request, params }: ActionFunctionArgs) {
  const stoneId = params.stone;
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
      `UPDATE main.stones SET name = ?, type = ?, url = ? WHERE id = ?`,
      [data.name, data.type, data.file, stoneId]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (params.stone === undefined) {
    return json({ name: undefined, type: undefined, file: undefined });
  }
  const stoneId = parseInt(params.stone);

  const stone = await selectId<{ name: string; type: string; file: string }>(
    db,
    "select name, type, url from stones WHERE id = ?",
    stoneId
  );
  return json({
    name: stone?.name,
    type: stone?.type,
    file: stone?.file,
  });
};

export default function StonesEdit() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { name, type, file } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const form = useForm<FormData>({
    resolver,
    defaultValues: stoneSchema.parse({ name, type, file }),
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
          <DialogTitle>Edit Stone</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
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
                <FileInput
                  inputName="stones"
                  id="image"
                  onChange={field.onChange}
                />
              )}
            />
            <DialogFooter>
              <LoadingButton loading={isSubmitting}>Edit Stone</LoadingButton>
            </DialogFooter>
          </Form>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
