import { ActionFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";
import {
  validateEmail,
  validatePhone,
  validateString,
} from "~/utils/formValidation";
import { db } from "~/db.server";

interface InputProps {
  name: string;
  type: string;
  error?: string;
}

interface FormError {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();

  const name = body.get("name");
  const email = body.get("email");
  const phone = body.get("phone");
  const address = body.get("address");

  const errors: FormError = {};

  if (!validateString(name, 2)) {
    errors.name = "invalid text provider";
  }
  if (!validateEmail(email)) {
    errors.email = "invalid text provider";
  }
  if (!validatePhone(phone)) {
    errors.phone = "invalid text provider";
  }
  if (!validateString(address, 10)) {
    errors.address = "invalid text provider";
  }

  if (Object.keys(errors).length > 0) {
    return json({ success: false, errors });
  }
  try {
    const result = await db.execute(
      `INSERT INTO main.customers (name, email, phone, address) VALUES (?, ?, ?, ?)`,
      [name, email, phone, address]
    );
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", errors);
  }
  return json({ success: true, errors });
}

function Input({ name, type, error }: InputProps) {
  return (
    <label htmlFor={name} className="block mb-5 font-bold text-gray-800">
      {name}
      <input
        type={type}
        id={name}
        className="w-full p-2 border border-gray-300 rounded-md text-base"
        name={name.toLowerCase()}
      />
      {error && <p className="  text-red-500">{error}</p>}
    </label>
  );
}

export default function Customer() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  console.log(actionData);

  return (
    <PageLayout title="Customers">
      <h2 id="formTitle" className="text-xl mb-4 text-gray-800">
        Add New Customer
      </h2>
      {actionData?.success && <h3>Success</h3>}
      <Form id="customerForm" method="post">
        <Input name="Name" type="text" error={actionData?.errors.name} />
        <Input name="Email" type="email" error={actionData?.errors.email} />
        <Input name="Phone" type="tel" error={actionData?.errors.phone} />
        <Input name="Address" type="text" error={actionData?.errors.address} />
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
