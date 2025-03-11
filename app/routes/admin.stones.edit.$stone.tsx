import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import {
  useNavigate,
  useLoaderData,
  useNavigation,
  Outlet,
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
import { commitSession, getSession } from "~/sessions";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { deleteFile } from "~/utils/s3.server";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const stoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["granite", "quartz", "marble", "dolomite", "quartzite"]),
  is_display: z.union([
    z.boolean(),
    z.number().transform((val) => val === 1),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ]),
  height: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  supplier: z.string().optional(),
  on_sale: z.union([
    z.boolean(),
    z.number().transform((val) => val === 1),
    z.enum(["true", "false"]).transform((val) => val === "true"),
  ]),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getAdminUser(request).catch((err) => {
    return redirect(`/login?error=${err}`);
  });
  await csrf.validate(request).catch(() => {
    return { error: "Invalid CSRF token" };
  });
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  const { errors, data } = await parseMutliForm(request, stoneSchema, "stones");
  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";
  const stone = await selectId<{ url: string }>(
    db,
    "SELECT url FROM stones WHERE id = ?",
    stoneId
  );
  try {
    if (newFile) {
      await db.execute(
        `UPDATE stones
         SET name = ?, type = ?, url = ?, is_display = ?, supplier = ?, height = ?, width = ?, on_sale = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.file,
          data.is_display,
          data.supplier,
          data.height,
          data.width,
          data.on_sale,
          stoneId,
        ]
      );
    } else {
      await db.execute(
        `UPDATE stones
         SET name = ?, type = ?, is_display = ?, supplier = ?, height = ?, width = ?, on_sale = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.is_display,
          data.supplier,
          data.height,
          data.width,
          data.on_sale,
          stoneId,
        ]
      );
    }
  } catch (error) {
    console.error("Error updating stone: ", error);
  }
  if (stone?.url && newFile) {
    await deleteFile(stone.url);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await getAdminUser(request).catch((err) => {
    return redirect(`/login?error=${err}`);
  });
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  const stone = await selectId<{
    name: string;
    type: string;
    url: string;
    is_display: boolean;
    supplier: string;
    height: string;
    width: string;
    on_sale: boolean;
  }>(
    db,
    "SELECT name, type, url, is_display, supplier, height, width, on_sale FROM stones WHERE id = ?",
    stoneId
  );
  if (!stone) {
    return forceRedirectError(request.headers, "No stone found");
  }
  const suppliers = await selectMany<{ supplier_name: string }>(
    db,
    "SELECT supplier_name FROM suppliers WHERE company_id = ?",
    [user.company_id]
  );
  return {
    stone,
    supplierNames: suppliers.map((item) => item.supplier_name),
  };
};

function StoneInformation({
  stoneData,
  supplierNames,
  refresh,
}: {
  stoneData: ReturnType<typeof loader>["stone"];
  supplierNames: string[];
  refresh: () => void;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const { name, type, url, is_display, supplier, height, width, on_sale } =
    stoneData;
  const defaultValues = {
    name,
    type,
    url: "",
    is_display,
    supplier,
    height,
    width,
    on_sale,
  };
  const form = useCustomOptionalForm(stoneSchema, defaultValues);

  return (
    <MultiPartForm form={form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <InputItem name="Name" placeholder="Stone name" field={field} />
        )}
      />
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <SelectInput
              name="Type"
              placeholder="Stone Type"
              field={field}
              options={["Granite", "Quartz", "Marble", "Dolomite", "Quartzite"]}
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
              type="image"
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="flex justify-between items-baseline gap-2">
        <div className="">
          <FormField
            control={form.control}
            name="is_display"
            render={({ field }) => <SwitchItem field={field} name="Display" />}
          />
          <FormField
            control={form.control}
            name="on_sale"
            render={({ field }) => <SwitchItem field={field} name="On Sale" />}
          />
        </div>
        <FormField
          control={form.control}
          name="supplier"
          render={({ field }) => (
            <SelectInput
              name="Supplier"
              placeholder="Supplier"
              field={field}
              options={supplierNames}
            />
          )}
        />
      </div>

      {url ? <img src={url} alt={name} className="w-48 mt-4 mx-auto" /> : null}
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="height"
          render={({ field }) => (
            <InputItem name="Height" placeholder="Stone height" field={field} />
          )}
        />
        <FormField
          control={form.control}
          name="width"
          render={({ field }) => (
            <InputItem name="Width" placeholder="Stone width" field={field} />
          )}
        />
      </div>

      <DialogFooter className="mt-4">
        <LoadingButton loading={isSubmitting}>Edit Stone</LoadingButton>
      </DialogFooter>
    </MultiPartForm>
  );
}
export default function StonesEdit() {
  const navigate = useNavigate();
  const { stone, supplierNames } = useLoaderData<{
    stone: {
      name: string;
      type: string;
      url: string;
      is_display: boolean;
      supplier: string;
      height: string;
      width: string;
      on_sale: boolean;
    };
    supplierNames: string[];
  }>();
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate("..");
    }
  };
  const refresh = () => {
    navigate(".", { replace: true });
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px] overflow-auto flex flex-col justify-baseline min-h-[95vh]  max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Edit Stone</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="information"
          onValueChange={(value) => {
            if (value === "images") navigate("images");
            else if (value === "slabs") {
              navigate("slabs");
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="information">General</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="slabs">Slabs</TabsTrigger>
          </TabsList>
          <TabsContent value="information">
            <StoneInformation
              stoneData={stone}
              supplierNames={supplierNames}
              refresh={refresh}
            />
          </TabsContent>
          <TabsContent value="images">
            <Outlet />
          </TabsContent>
          <TabsContent value="slabs">
            <Outlet />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
