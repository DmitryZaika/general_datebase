import { LoadingButton } from "~/components/molecules/LoadingButton";
import { STONE_TYPES, STONE_FINISHES } from "~/utils/constants";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import {
  useNavigate,
  useNavigation,
  Outlet,
  useLoaderData,
  useLocation,
} from "react-router";
import { FormField } from "../components/ui/form";
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
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { selectMany } from "~/utils/queryHelpers";
import { stoneSchema } from "~/schemas/stones";
import { SelectManyBadge } from "~/components/molecules/SelectManyBadge";

export async function action({ request }: ActionFunctionArgs) {
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

  const user = await getAdminUser(request);
  const [result]: any = await db.execute(
    `INSERT INTO stones
     (name, type, finishing, url, company_id, is_display, on_sale, supplier_id, width, length, cost_per_sqft, retail_price, level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      data.name,
      data.type,
      data.finishing,
      data.file,
      user.company_id,
      data.is_display,
      data.on_sale,
      data.supplier_id,
      data.width || 0,
      data.length || 0,
      data.cost_per_sqft || 0,
      data.retail_price || 0,
      data.level ?? null,
    ],
  );

  const stoneId = result.insertId;

  let colorsArray: number[] = [];
  
  if (typeof data.colors === 'string') {
    try {
      if (data.colors.startsWith('[')) {
        colorsArray = JSON.parse(data.colors).map(Number);
      } else {
        colorsArray = [Number(data.colors)];
      }
    } catch (e) {
    }
  }
  else if (Array.isArray(data.colors)) {
    colorsArray = data.colors.map(Number);
  }
  
  colorsArray = colorsArray.filter(id => !isNaN(id) && id > 0);

  if (colorsArray.length > 0) {
    for (const colorId of colorsArray) {
      if (isNaN(colorId) || colorId <= 0) {
        continue;
      }
      
      try {
        await db.execute(
          `INSERT INTO stone_colors (stone_id, color_id) VALUES (?, ?)`,
          [stoneId, colorId]
        );
      } catch (err) {
      }
    }
  }
  
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';
  
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone added"));
  return redirect(`..${searchString}`, {
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
    const colors = await selectMany<{
      id: number;
      name: string;
      hex_code: string;
    }>(db, "SELECT id, name, hex_code FROM colors ORDER BY name ASC");
    return { suppliers, colors };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function StonesAdd() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSubmitting = useNavigation().state !== "idle";
  const { suppliers, colors } = useLoaderData<typeof loader>();

  const form = useCustomForm(stoneSchema, {
    defaultValues: {
      is_display: true,
      colors: [],
      finishing: "polished",
    },
  });

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
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
                inputAutoFocus={true}
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
              name="finishing"
              render={({ field }) => (
                <SelectInput
                  field={field}
                  placeholder="Finishing"
                  name="Finishing"
                  options={STONE_FINISHES.map((item) => ({
                    key: item.toLowerCase(),
                    value: item.charAt(0).toUpperCase() + item.slice(1),
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
              name="length"
              render={({ field }) => (
                <InputItem
                  name={"Length"}
                  placeholder={"Length of the stone"}
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
              name="retail_price"
              render={({ field }) => (
                <InputItem
                  name={"Retail Price"}
                  placeholder={"Retail Price"}
                  field={field}
                />
              )}
            />
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
     
          </div>
          <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <SelectInput
                 className="w-1/2"
                  options={[1, 2, 3, 4, 5, 6, 7].map((item) => ({
                    key: item.toString(),
                    value: item.toString(),
                  }))}
                  name={"Level"}
                  placeholder={"Level of the stone"}
                  field={field}
                />
              )}
            />
          <FormField
            control={form.control}
            name="colors"
            render={({ field }) => {
              if (!field.value) field.value = [];
              if (!Array.isArray(field.value)) field.value = [String(field.value)];
              
              if (Array.isArray(field.value) && field.value.length > 0) {
                const invalidIds = field.value.filter(id => 
                  !colors.some(c => c.id.toString() === id)
                );
                if (invalidIds.length > 0) {
                }
              }
              
              return (
                <SelectManyBadge
                  options={colors.map((item) => ({
                    key: item.id.toString(),
                    value: item.name,
                  }))}
                  name={"Color"}
                  placeholder={"Color of the stone"}
                  field={field}
                  badges={colors
                    .filter(item => 
                      Array.isArray(field.value) && 
                      field.value.includes(item.id.toString())
                    )
                    .reduce((acc, item) => ({
                      ...acc,
                      [item.name]: item.hex_code
                    }), {})}
                  showCheckmarks={false}
                />
              );
            }}
          />

          <DialogFooter>
            <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
          </DialogFooter>
        </MultiPartForm>
      </DialogContent>
    </Dialog>
  );
}
