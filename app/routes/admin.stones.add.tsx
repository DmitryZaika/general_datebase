import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  useNavigate,
  useNavigation,
  Outlet,
  useLoaderData,
} from "@remix-run/react";
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

const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  is_display: z.union([
    z.boolean(),
    z.number().transform((val) => val === 1),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ]),
  height: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
  supplier: z.string().optional(),
  bundle: z.string().optional(),
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

  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return { errors };
  }
  let user = await getAdminUser(request);
  try {
    await db.execute(
      `INSERT INTO main.stones (name, type, url, company_id, is_display, supplier, width, height, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
    const stoneId = parseInt(params.stone ?? "0", 10);
    if (!stoneId) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing stone ID" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      await db.execute(
        `INSERT INTO main.slab_inventory (bundle, stone_id) VALUES (?, ?);`,
        [data.bundle, stoneId]
      );
    } catch (error) {
      console.error("Error connecting to the database: ", error);
      const session = await getSession(request.headers.get("Cookie"));
      session.flash(
        "message",
        toastData("Failure", "Database Error Occured", "destructive")
      );
      return new Response(JSON.stringify({ error: "Database Error Occured" }), {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));
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

export default function StonesAdd() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { supplier } = useLoaderData<typeof loader>();

  const form = useCustomForm(stoneSchema, {
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
          <DialogTitle>Add Stone</DialogTitle>
        </DialogHeader>
        <MultiPartForm form={form}>
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
                ].map((item) => ({ key: item.toLowerCase(), value: item }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                inputName="stones"
                type="image"
                id="image"
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            defaultValue={true}
            control={form.control}
            name="is_display"
            render={({ field }) => <SwitchItem field={field} name="Display" />}
          />
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <InputItem
                  name={"Height"}
                  placeholder={"Height of the stone"}
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
                  placeholder={"Width of the stone"}
                  field={field}
                />
              )}
            />
          </div>
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
                placeholder={"Supplier of the stone"}
                field={field}
              />
            )}
          />
          {inputFields.map((field, index) => (
            <div key={index} className="flex gap-2">
              <FormField
                control={form.control}
                name={`bundle[${index}].slab`}
                render={({ field }) => (
                  <InputItem
                    formClassName="mb-0"
                    className="mb-2"
                    placeholder={`Slab number ${index + 1}`}
                    field={field}
                  />
                )}
              />

              <Button type="button" onClick={() => handleDelete(index)}>
                <X />
              </Button>
            </div>
          ))}

          <Button type="button" onClick={addSlab}>
            Add Slab
          </Button>

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
