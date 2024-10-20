import { ActionFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";

import { db } from "~/db.server";

interface InputProps {
  name: string;
  type: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();

  const name = body.get("name");
  const email = body.get("email");
  const phone = body.get("phone");
  const address = body.get("address");

  console.log({ name, email, phone, address });

  try {
    const result = await db.execute(
      `INSERT INTO main.customers (name, email, phone, address) VALUES (?, ?, ?, ?)`,
      [name, email, phone, address]
    );
    console.log(result);

    return json({ success: true });
  } catch (error) {
    console.error("Error connecting to the database: ", error);
    return json({
      success: false,
      error: "There was an error processing your request.",
    });
  }
}

function Input({ name, type }: InputProps) {
  return (
    <label htmlFor={name} className="block mb-2 font-bold text-gray-800">
      {name}
      <input
        type={type}
        id={name}
        className="w-full p-2 border border-gray-300 rounded-md text-base mb-4"
        name={name.toLowerCase()}
      />
    </label>
  );
}

export default function Customer() {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  console.log(data?.success);

  return (
    <PageLayout title="Customers">
      <h2 id="formTitle" className="text-xl mb-4 text-gray-800">
        Add New Customer
      </h2>
      {data?.success && <h3>Success</h3>}
      <Form id="customerForm" method="post">
        <input type="hidden" id="customerId" />
        <Input name="Name" type="text" />
        <Input name="Email" type="email" />
        <Input name="Phone" type="tel" />
        <Input name="Address" type="text" />
        <button
          disabled={navigation.state === "submitting"}
          type="submit"
          className="w-full p-2
             bg-gray-800
              text-yellow-400 
              rounded-md text-lg 
              font-bold cursor-pointer 
              transition duration-300 
              ease-in-out hover:bg-gray-700"
        >
          Add Customer
        </button>
      </Form>
    </PageLayout>
  );
}
