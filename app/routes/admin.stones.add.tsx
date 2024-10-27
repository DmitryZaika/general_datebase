import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { useActionData, useSubmit, Form, useNavigate } from "@remix-run/react";
import { Form as FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import { db } from "~/db.server";
import { SelectInput } from "~/components/molecules/SelectItem";

const stoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["granite", "guartz", "garble", "dolomite", "quartzites"]),
});

type FormData = z.infer<typeof stoneSchema>;

const resolver = zodResolver(stoneSchema);

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
      `INSERT INTO main.stones (name, type) VALUES (?, ?)`,
      [data.name, data.type]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  return redirect("..");
}

export default function StonesAdd() {
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const form = useForm<FormData>({
    resolver,
  });

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
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
                    "Quartzites",
                  ]}
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
