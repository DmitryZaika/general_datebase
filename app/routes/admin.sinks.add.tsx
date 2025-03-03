import { LoadingButton } from "~/components/molecules/LoadingButton";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import {
  useNavigate,
  useNavigation,
  Outlet,
  useLoaderData,
} from "react-router";
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
import { SelectInput } from "~/components/molecules/SelectItem";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { FileInput } from "~/components/molecules/FileInput";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { useCustomForm } from "~/utils/useCustomForm";
import { getAdminUser, getEmployeeUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";

const sinkSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum([
    "stainless 18 gage",
    "stainless 16 gage",
    "composit",
    "ceramic",
  ]),
  is_display: z.union([
    z.boolean(),
    z.number().transform((val) => val === 1),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ]),
  height: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  supplier: z.string().optional(),
  amount: z.coerce.number().optional(),
});

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }

  const { errors, data } = await parseMutliForm(request, sinkSchema, "sinks");
  if (errors || !data) {
    return { errors };
  }
  let user = await getAdminUser(request);
  try {
    await db.execute(
      `INSERT INTO main.sinks (name, type, url, company_id, is_display, supplier, width, height, amount) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        data.name,
        data.type,
        data.file,
        user.company_id,
        data.is_display,
        data.supplier,
        data.width,
        data.height,
        data.amount,
      ]
    );
  } catch (error) {
    console.error("Error connecting to the database: ", error);
    const sinkId = parseInt(params.sink ?? "0", 10);
    if (!sinkId) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing sink ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink added"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getAdminUser(request);
    const suppliers = await selectMany<{ supplier_name: string }>(
      db,
      "SELECT supplier_name FROM suppliers WHERE company_id = ?",
      [user.company_id]
    );
    return { supplier: suppliers.map((item) => item.supplier_name) };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SinksAdd() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { supplier } = useLoaderData<typeof loader>();

  const form = useCustomForm(sinkSchema, {
    defaultValues: {
      is_display: true,
    },
  });

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };

  const [inputFields, setInputFields] = useState<
    {
      slab: string;
      sold: boolean;
    }[]
  >([]);

  const addSlab = () => {
    setInputFields([...inputFields, { slab: "", sold: false }]);
  };

  const handleDelete = (index: number) => {
    const newFields = inputFields.filter((_, i) => i !== index);
    setInputFields(newFields);
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name={"Name"}
                placeholder={"Name of the sink"}
                field={field}
              />
            )}
          />
          <div className="flex gap-2">
            {" "}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder="Type of the Sink"
                  name="Type"
                  options={[
                    "Stainless 18 gage",
                    "Stainless 16 gage",
                    "Composit",
                    "Ceramic",
                  ].map((item) => ({ key: item.toLowerCase(), value: item }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FileInput
                  inputName="sinks"
                  type="image"
                  id="image"
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex justify-between gap-2">
            <FormField
              defaultValue={true}
              control={form.control}
              name="is_display"
              render={({ field }) => (
                <SwitchItem field={field} name="Display" />
              )}
            />
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <SelectInput
                  options={supplier.map((item) => ({
                    key: item.toLowerCase(),
                    value: item,
                  }))}
                  name={"Supplier"}
                  placeholder={"Supplier of the sink"}
                  field={field}
                />
              )}
            />
          </div>

          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <InputItem
                  name={"Height"}
                  placeholder={"Height of the sink"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <InputItem
                  name={"Width"}
                  placeholder={"Width of the sink"}
                  field={field}
                />
              )}
            />
          </div>
          <div className="flexs gap-2">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <InputItem
                  name={"Amount"}
                  placeholder={"Amount of the sink"}
                  field={field}
                />
              )}
            />
          </div>

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Sink</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
