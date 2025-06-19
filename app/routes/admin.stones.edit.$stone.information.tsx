import { STONE_TYPES, STONE_FINISHES } from "~/utils/constants";
import {
    ActionFunctionArgs,
    LoaderFunctionArgs,
    redirect,
    useLoaderData,
  useNavigation,
} from "react-router";

import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import {
  DialogFooter,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { FormField } from "../components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { stoneSchema } from "~/schemas/stones";
import { getAdminUser } from "~/utils/session.server";
import { commitSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { csrf } from "~/utils/csrf.server";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { deleteFile } from "~/utils/s3.server";
import { getSession } from "~/sessions";
import { SelectManyBadge } from "~/components/molecules/SelectManyBadge";


export async function action({ request, params }: ActionFunctionArgs) {
    await getAdminUser(request).catch((err) => {
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
           SET name = ?, type = ?, finishing = ?, url = ?, is_display = ?, supplier_id = ?, length = ?, width = ?, on_sale = ?, cost_per_sqft = ?, level = ?, retail_price = ?
           WHERE id = ?`,
          [
            data.name,
            data.type,
            data.finishing,
            data.file,
            data.is_display,
            data.supplier_id,
            data.length,
            data.width,
            data.on_sale,
            data.cost_per_sqft,
            data.level || null,
            data.retail_price,
            stoneId,
          ]
        );
      } else {
        await db.execute(
          `UPDATE stones
           SET name = ?, type = ?, finishing = ?, is_display = ?, supplier_id = ?, length = ?, width = ?, on_sale = ?, cost_per_sqft = ?, level = ?, retail_price = ?
           WHERE id = ?`,
          [
            data.name,
            data.type,
            data.finishing,
            data.is_display,
            data.supplier_id,
            data.length,
            data.width,
            data.on_sale,
            data.cost_per_sqft,
            data.level || null,
            data.retail_price,
            stoneId,
          ]
        );
      }
      
      let colorsArray: number[] = [];
      const colorsField = data.colors;
      
      if (typeof colorsField === 'string') {
        try {
          if (colorsField.startsWith('[')) {
            colorsArray = JSON.parse(colorsField).map(Number);
          } else if (colorsField) {
            colorsArray = [Number(colorsField)];
          }
        } catch (e) {
        }
      } else if (Array.isArray(colorsField)) {
        colorsArray = colorsField.map(Number);
      }
      
      colorsArray = colorsArray.filter(id => !isNaN(id) && id > 0);
      
      await db.execute(
        `DELETE FROM stone_colors WHERE stone_id = ?`,
        [stoneId]
      );
      
      if (colorsArray.length > 0) {
        for (const colorId of colorsArray) {
          await db.execute(
            `INSERT INTO stone_colors (stone_id, color_id) VALUES (?, ?)`,
            [stoneId, colorId]
          );
        }
      }
      
      if (stone?.url && newFile) {
        await deleteFile(stone.url);
      }
  
      const url = new URL(request.url);
      const searchParams = url.searchParams.toString();
      const searchString = searchParams ? `?${searchParams}` : '';
  
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "Stone Edited"));
      return redirect(`../..${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    } catch (error) {
      return { errors: { message: "Failed to update stone" } };
    }
  }

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const user = await getAdminUser(request);
    if (!params.stone) {
      return forceRedirectError(request.headers, "No stone id provided");
    }
    const stoneId = parseInt(params.stone, 10);
    const stone = await selectId<{
      name: string;
      type: string;
      url: string;
      is_display: boolean;
      supplier_id: string;
      length: string;
      width: string;
      on_sale: boolean;
      cost_per_sqft: number;
      retail_price: number;
      level: number | null;
      finishing: string | null;
    }>(
      db,
      "SELECT name, type, url, is_display, supplier_id, length, width, on_sale, cost_per_sqft, retail_price, level, finishing FROM stones WHERE id = ?",
      stoneId
    );
    if (!stone) {
      return forceRedirectError(request.headers, "No stone found");
    }
    const suppliers = await selectMany<{
      id: number | null;
      supplier_name: string;
    }>(db, "SELECT id, supplier_name FROM suppliers WHERE company_id = ?", [
      user.company_id,
    ]);
    
    const colors = await selectMany<{
      id: number;
      name: string;
      hex_code: string;
    }>(db, "SELECT id, name, hex_code FROM colors ORDER BY name ASC");
    
    const stoneColors = await selectMany<{
      color_id: number;
    }>(db, "SELECT color_id FROM stone_colors WHERE stone_id = ?", [stoneId]);
    
    const selectedColorIds = stoneColors.map(item => item.color_id.toString());
    
    return {
      stone,
      suppliers,
      colors,
      selectedColorIds,
    };
  };


export default function Information() {
    const navigation = useNavigation();
    const { stone, suppliers, colors, selectedColorIds } = useLoaderData<typeof loader>();
    const isSubmitting = navigation.state !== "idle";
    const {
      name,
      type,
      url,
      is_display,
      supplier_id,
      length,
      width,
      on_sale,
      cost_per_sqft,
      retail_price,
      level,
      finishing,
    } = stone;
    const defaultValues = {
      name,
      type,
      url: "",
      is_display,
      supplier_id,
      length,
      width,
      on_sale,
      cost_per_sqft,
      retail_price,
      level,
      finishing,
      colors: selectedColorIds,
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
                options={STONE_TYPES.map((type) => ({
                  key: type,
                  value: type,
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
                id="image"
                type="image"
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="flex justify-between items-baseline gap-2">
          <div>
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
            name="supplier_id"
            render={({ field }) => (
              <SelectInput
                name="Supplier"
                placeholder="Supplier"
                field={field}
                options={suppliers.map((item) => ({
                  key: item.id?.toString() ?? "",
                  value: item.supplier_name,
                }))}
              />
            )}
          />
        </div>
        {url ? <img src={url} alt={name} className="w-48  mx-auto" /> : null}
       
        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="length"
            render={({ field }) => (
              <InputItem name="Length" placeholder="Stone length" field={field} />
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
        <div className="flex gap-2">
        <FormField
            control={form.control}
            name="retail_price"
            render={({ field }) => (
              <InputItem
                name="Retail Price"
                placeholder="Retail Price"
                field={field}
              />
            )}
          />
          <FormField
            control={form.control}
            name="cost_per_sqft"
            render={({ field }) => (
              <InputItem
                name="Cost Per Sqft"
                placeholder="Cost Per Sqft"
                field={field}
              />
            )}
          />
        </div>
        <div className="flex gap-2">
        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <SelectInput
              className="w-1/2"
              name="Level"
              placeholder="Stone level"
              field={field}
              options={[1, 2, 3, 4, 5, 6, 7].map((item) => ({
                key: item.toString(),
                value: item.toString(),
              }))}
            />
          )}
        />
          <FormField
            control={form.control}
            name="finishing"
            render={({ field }) => (
              <SelectInput
                className="w-1/2"
                name="Finishing"
                placeholder="Select Finishing"
                field={field}
                options={STONE_FINISHES.map((finish) => ({
                  key: finish,
                  value: finish.charAt(0).toUpperCase() + finish.slice(1),
                }))}
              />
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="colors"
          render={({ field }) => {
            if (!field.value) field.value = [];
            if (!Array.isArray(field.value)) field.value = [String(field.value)];
            
            return (
              <SelectManyBadge
                options={colors?.map((item) => ({
                  key: item.id.toString(),
                  value: item.name,
                })) || []}
                name={"Colors"}
                placeholder={"Select stone colors"}
                field={field}
                badges={(colors || [])
                  .filter(item => 
                    Array.isArray(field.value) && 
                    field.value.includes(item.id.toString())
                  )
                  .reduce((acc, item) => ({
                    ...acc,
                    [item.name]: item.hex_code
                  }), {})}
              />
            );
          }}
        />
        
        <DialogFooter className="mt-4">
          <LoadingButton loading={isSubmitting}>Save Changes</LoadingButton>
        </DialogFooter>
      </MultiPartForm>
    );
}
