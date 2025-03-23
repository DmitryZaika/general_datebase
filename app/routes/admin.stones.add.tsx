import { LoadingButton } from "~/components/molecules/LoadingButton";
import { STONE_TYPES } from "~/utils/constants";
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
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { selectMany } from "~/utils/queryHelpers";
import { stoneSchema } from "~/schemas/stones";

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
      `INSERT INTO main.stones
       (name, type, url, company_id, is_display, on_sale, supplier_id, width, height, cost_per_sqft, retail_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        data.name,
        data.type,
        data.file,
        user.company_id,
        data.is_display,
        data.on_sale,
        data.supplier_id,
        data.width,
        data.height,
        data.cost_per_sqft,
        data.retail_price,
      ],
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
        },
      );
    }

    try {
      await db.execute(
        `INSERT INTO main.slab_inventory (bundle, stone_id) VALUES (?, ?);`,
        [data.bundle, stoneId],
      );
    } catch (error) {
      console.error("Error connecting to the database: ", error);
      const session = await getSession(request.headers.get("Cookie"));
      session.flash(
        "message",
        toastData("Failure", "Database Error Occured", "destructive"),
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
    const suppliers = await selectMany<{
      id: number;
      supplier_name: string;
    }>(db, "SELECT id,  supplier_name FROM suppliers WHERE company_id = ?", [
      user.company_id,
    ]);
    return { suppliers };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function StonesAdd() {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { suppliers } = useLoaderData<typeof loader>();

  const form = useCustomOptionalForm(stoneSchema, {
    defaultValues: {
      is_display: true,
    },
  });

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
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
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder="Type of the Stone"
                  name="Type"
                  options={STONE_TYPES.map((item) => ({
                    key: item.toLowerCase(),
                    value: item,
                  }))}
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
          </div>

          <div className="flex justify-between gap-2">
            <div className="">
              <FormField
                defaultValue={true}
                control={form.control}
                name="is_display"
                render={({ field }) => (
                  <SwitchItem field={field} name="Display" />
                )}
              />
              <FormField
                defaultValue={false}
                control={form.control}
                name="on_sale"
                render={({ field }) => (
                  <SwitchItem field={field} name="On Sale" />
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <SelectInput
                  options={suppliers.map((item) => ({
                    key: item.id.toString(),
                    value: item.supplier_name,
                  }))}
                  name={"Supplier"}
                  placeholder={"Supplier of the stone"}
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

          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="cost_per_sqft"
              render={({ field }) => (
                <InputItem
                  name={"Cost Per Sqft"}
                  placeholder={"Cost Per Sqft"}
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="retail_price"
              render={({ field }) => (
                <InputItem
                  name={"Retail Price"}
                  placeholder={"Retail Price"}
                  field={field}
                />
              )}
            />
          </div>

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
