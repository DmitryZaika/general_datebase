import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { Form, useLoaderData, useNavigate } from "react-router";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { useAuthenticityToken } from "remix-utils/csrf/react";

import { csrf } from "~/utils/csrf.server";
import { getSuperUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";
import { saveCompanyQBO } from "~/utils/quickbooks.server";

interface Company {
  id: number;
  name: string;
}

const userschema = z.object({
  companyId: z.coerce.number().min(1),
  qboClientId: z.string().min(10),
  qboClientSecret: z.string().min(10),
  qboRealmId: z.coerce.number().gt(10000)
});

type FormData = z.infer<typeof userschema>;
const resolver = zodResolver(userschema);

export async function action({ request }: ActionFunctionArgs) {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver,
  );
  if (errors) {
    return { errors, receivedValues };
  }
  try {
    saveCompanyQBO(data.companyId, data.qboClientId, data.qboClientSecret, data.qboRealmId);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "user added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const companies = await selectMany<Company>(
    db,
    "select id, name from company",
  );
  return { companies };
};

export default function UsersAdd() {
  const navigate = useNavigate();
  const { companies } = useLoaderData<typeof loader>();
  const token = useAuthenticityToken();
  const form = useForm<FormData>({
    resolver,
  });
  const fullSubmit = useFullSubmit(form);
  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className="container mx-auto py-5">
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <SelectInput
              field={field}
              name="Company"
              options={companies.map((company) => ({
                key: company.id,
                value: company.name,
              }))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="qboClientId"
          render={({ field }) => (
            <InputItem name="QBO Client Id"field={field}/>
          )}
        />
        <FormField
          control={form.control}
          name="qboClientSecret"
          render={({ field }) => (
            <InputItem name="QBO Client Secret" field={field}/>
          )}
        />
        <FormField
          control={form.control}
          name="qboRealmId"
          render={({ field }) => (
            <InputItem name="QBO Realm Id" field={field}/>
          )}
        />
          <Button type="submit">Save changes</Button>
      </Form>
    </FormProvider>
  );
}
