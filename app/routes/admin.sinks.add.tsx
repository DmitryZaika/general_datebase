import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { useSubmit, Form, useNavigate } from "@remix-run/react";
import {
  FormProvider,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "../components/ui/form";
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
import { toastData } from "~/utils/toastHelpers";
import { Input } from "~/components/ui/input";

const sinkSchema = z.object({
  name: z.string().min(1),
});

const formSchema = z.object({
  file:
    typeof window === "undefined"
      ? z.any()
      : z
          .instanceof(FileList)
          .refine((file) => file?.length > 0, "File is required."),
});

type FormData = z.infer<typeof sinkSchema>;

const resolver = zodResolver(sinkSchema);

export async function action({ request }: ActionFunctionArgs) {
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
      `INSERT INTO main.sinks (name) VALUES (?)`,
      [data.name]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function SinksAdd() {
  const navigate = useNavigate();

  const submit = useSubmit();
  const form = useForm<FormData>({
    resolver,
  });

  const fileForm = useForm({
    resolver: zodResolver(formSchema),
  });
  const fileRef = fileForm.register("file");
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
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
                  name={"Name"}
                  placeholder={"Name of the Sink"}
                  field={field}
                />
              )}
            />
            <FormProvider {...fileForm}>
              <form
                onSubmit={fileForm.handleSubmit((data) => {
                  console.log(data);
                })}
                className="w-full"
              >
                <FormField
                  control={fileForm.control}
                  name="file"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <Input
                          className="cursor-pointer"
                          type="file"
                          placeholder="Upload file"
                          {...fileRef}
                          onChange={(event) => {
                            field.onChange(event.target.files);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Upload File</Button>
              </form>
            </FormProvider>
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
