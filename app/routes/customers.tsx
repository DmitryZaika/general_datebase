import { ActionFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useSubmit } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";
import { z } from "zod";
import { db } from "~/db.server";
import { Button } from "~/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { getValidatedFormData } from "remix-hook-form";
import { useForm } from "react-hook-form";
import {
  FormProvider,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { InputItem } from "~/components/molecules/InputItem";

const customerSchema = z.object({
  name: z.string().min(5),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(10).optional(),
  address: z.string().min(10).optional(),
});

type FormData = z.infer<typeof customerSchema>;

const resolver = zodResolver(customerSchema);

export async function action({ request }: ActionFunctionArgs) {
  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<FormData>(request, resolver);
  if (errors) {
    return { errors, defaultValues };
  }

  try {
    await db.execute(
      `INSERT INTO main.customers (name, email, phone, address) VALUES (?, ?, ?, ?)`,
      [data.name, data.email, data.phoneNumber, data.address]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  return { success: true };
}

export default function Customer() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const form = useForm<FormData>({
    resolver,
  });

  return (
    <PageLayout
      className="bg-white p-5 rounded-lg shadow-[0px_-0px_5px_rgba(0,0,0,0.15)]  max-w-lg mx-auto my-5"
      title="Customers
    "
    >
      <h2 id="formTitle" className="text-xl mb-4 text-gray-800">
        Add New Customer
      </h2>
      {actionData?.success && <h3>Success</h3>}
      <FormProvider {...form}>
        <Form
          id="customerForm"
          method="post"
          onSubmit={form.handleSubmit(
            (data) => {
              submit(data, { method: "post", encType: "multipart/form-data" });
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
                placeholder={"Your name"}
                field={field}
              />
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="Your Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input placeholder="Your phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="Your address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </Form>
      </FormProvider>
    </PageLayout>
  );
}
