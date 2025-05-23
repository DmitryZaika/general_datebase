import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
  useNavigation,
  useNavigate,
  Link,
  useFetcher,
  Outlet,
  useLocation,
  Params
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { Button } from "~/components/ui/button";
import { DeleteRow } from "~/components/pages/DeleteRow";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FormProvider, FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { SelectInput } from "~/components/molecules/SelectItem";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import React, { useState, useEffect } from "react";
import { coerceNumberRequired } from "~/schemas/general";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

interface SaleDetails {
  id: number;
  customer_id: number;
  customer_name: string;
  sale_date: string;
  seller_id: number;
  seller_name: string;
  notes: string | null;
  square_feet: number | null;
  price: number | null;
}

interface SaleSlab {
  id: number;
  stone_id: number;
  bundle: string;
  stone_name: string;
  cut_date: string | null;
  notes: string | null;
  square_feet: number | null;
  has_children?: boolean;
  child_count?: number;
}

interface SaleSink {
  id: number;
  sink_type_id: number;
  name: string;
  price: number;
  is_deleted: number;
}

interface Sink {
  id: number;
  name: string;
  type: string;
  retail_price: number;
}

interface Customer {
  id: number;
  name: string;
}
const slabSchema = z.object({
  notes: z.string().optional(),
  square_feet: z.coerce.number().optional(),
  full_slab_sold: z.boolean().optional(),
})

type SlabFormData = z.infer<typeof slabSchema>;
const slabsResolver = zodResolver(slabSchema);

const sinkSchema = z.object({
  sink_type_id: z.coerce.number(),
  price: z.coerce.number(),
})

type SinkFormData = z.infer<typeof sinkSchema>;
const sinksResolver = zodResolver(sinkSchema);


const sinkAddSchema = z.object({
  sink_type_id: z.string().min(1, "Please select a sink"),
  price: z.coerce.number().optional(),
});

type SinkAddFormData = z.infer<typeof sinkAddSchema>;
const sinkAddResolver = zodResolver(sinkAddSchema);

const customerSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
});

type CustomerFormData = z.infer<typeof customerSchema>;
const customerResolver = zodResolver(customerSchema);

const saleInfoSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  seller_id: z.coerce.number().min(1, "Seller is required"),
  notes: z.string().optional(),
  total_square_feet: coerceNumberRequired,
  price: coerceNumberRequired,
  sale_date: z.string().min(1, "Sale date is required")
});

type SaleInfoFormData = z.infer<typeof saleInfoSchema>;
const saleInfoResolver = zodResolver(saleInfoSchema);

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request);
  if (!params.saleId) {
    return forceRedirectError(request.headers, "No sale ID provided");
  }
  const saleId = parseInt(params.saleId, 10);
  

  
  if (isNaN(saleId)) {
    return forceRedirectError(request.headers, "Invalid sale ID format");
  }
  
  const checkSales = await selectMany<{id: number, company_id: number}>(
    db,
    `SELECT id, company_id FROM sales WHERE id = ?`,
    [saleId]
  );
  
  
  if (checkSales.length === 0) {
    return forceRedirectError(request.headers, "Sale does not exist in database");
  }
  
  if (checkSales[0].company_id !== user.company_id) {
  
    return forceRedirectError(request.headers, "Sale belongs to different company");
  }
  
  const sales = await selectMany<SaleDetails>(
    db,
    `SELECT 
      s.id, s.customer_id, c.name as customer_name, 
      s.sale_date, s.seller_id, u.name as seller_name, s.notes, s.square_feet, s.price
     FROM sales s
     JOIN customers c ON s.customer_id = c.id
     JOIN users u ON s.seller_id = u.id
     WHERE s.id = ? AND s.company_id = ?`,
    [saleId, user.company_id]
  );
  
  
  const sale = sales[0];
  
  if (!sale) {
    return forceRedirectError(request.headers, "Sale details could not be retrieved");
  }
  
  const slabs = await selectMany<SaleSlab>(
    db,
    `SELECT 
      slab_inventory.id, slab_inventory.stone_id, slab_inventory.bundle, stones.name as stone_name, 
      slab_inventory.cut_date, slab_inventory.notes, slab_inventory.square_feet
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.sale_id = ? AND slab_inventory.cut_date IS NULL
     ORDER BY slab_inventory.id`,
    [saleId]
  );
  
  // Проверяем наличие дочерних слебов для каждого слеба
  for (const slab of slabs) {
    const [childSlabsResult] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM slab_inventory WHERE parent_id = ?`,
      [slab.id]
    );
    
    const childCount = childSlabsResult[0].count;
    slab.has_children = childCount > 0;
    slab.child_count = childCount;
  }
  
  const sinks = await selectMany<SaleSink>(
    db,
    `SELECT 
      sinks.id, sinks.sink_type_id, sink_type.name, sinks.price, sinks.is_deleted
     FROM sinks
     JOIN sink_type ON sinks.sink_type_id = sink_type.id
     WHERE sinks.sale_id = ?
     ORDER BY sinks.id`,
    [saleId]
  );
  
  const availableSinks = await selectMany<Sink>(
    db,
    `SELECT id, name, type, retail_price
     FROM sink_type
     WHERE company_id = ? AND EXISTS (
         SELECT 1 
         FROM sinks 
         WHERE sinks.sink_type_id = sink_type.id 
         AND sinks.is_deleted = 0
     )
     ORDER BY name ASC`,
    [user.company_id]
  );
  
  const sellers = await selectMany<{id: number, name: string, position_id: number}>(
    db,
    `SELECT id, name, position_id FROM users WHERE company_id = ? AND position_id IN (1, 2, 5) ORDER BY name ASC`,
    [user.company_id]
  );
  
  return { 
    sale,
    slabs,
    sinks,
    availableSinks,
    sellers,
  };
}



export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  if (!params.saleId) {
    return forceRedirectError(request.headers, "No sale ID provided");
  }
  
  const saleId = parseInt(params.saleId, 10);
  if (isNaN(saleId)) {
    return forceRedirectError(request.headers, "Invalid sale ID format");
  }

  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone ID provided");
  }

  const stoneId = parseInt(params.stone, 10);
  if (isNaN(stoneId)) {
    return forceRedirectError(request.headers, "Invalid stone ID format");
  }
  
  try {
    await csrf.validate(request);
  } catch (error) {
    console.error("CSRF validation error:", error);
    return { error: "Invalid CSRF token" };
  }
  
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  
  // Add a new intent for cutting slabs directly
  if (intent === "cut-slab") {
    const slabId = Number(formData.get("slabId"));
    
    if (isNaN(slabId)) {
      return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}?error=Invalid+slab+ID`);
    }
    
    // Update the slab's cut_date
    await db.execute(
      `UPDATE slab_inventory SET cut_date = CURRENT_TIMESTAMP WHERE id = ?`,
      [slabId]
    );
    
    // Check if there are any uncut slabs remaining
    const [remainingSlabsResult] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM slab_inventory 
       WHERE sale_id = ? AND cut_date IS NULL`,
      [saleId]
    );
    
    const remainingSlabsCount = remainingSlabsResult[0].count;
    const cutType = remainingSlabsCount > 0 ? "partially cut" : "cut";
    
    await db.execute(
      `UPDATE sales SET status = ? WHERE id = ?`,
      [cutType, saleId]
    );
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab marked as cut"));
    
    // Return redirect instead of json
    return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}${new URL(request.url).search}`, {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  }
  
  // Original action code continues below
  try {
    if (intent === "sale-unsell") {
   
      // First find all slabs in this sale to check for child slabs later
      const [slabsToUnsell] = await db.execute<RowDataPacket[]>(
        "SELECT id FROM slab_inventory WHERE sale_id = ?",
        [saleId]
      );


      // Process all slabs that are being unsold
      if (slabsToUnsell && slabsToUnsell.length > 0) {
        for (const slabRow of slabsToUnsell) {
          const parentId = slabRow.id;
          
          // Check if this slab has any sold child slabs
          const [soldChildSlabs] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM slab_inventory WHERE parent_id = ? AND sale_id IS NOT NULL",
            [parentId]
          );
          
          if (soldChildSlabs && soldChildSlabs.length > 0) {
            
            // If this slab has sold children, delete it entirely rather than unselling it
            const [deleteResult] = await db.execute<ResultSetHeader>(
              "DELETE FROM slab_inventory WHERE id = ?",
              [parentId]
            );
          } else {
            // Check for unsold child slabs
            const [unsoldChildSlabs] = await db.execute<RowDataPacket[]>(
              "SELECT id FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0)",
              [parentId]
            );
            
            
            if (unsoldChildSlabs && unsoldChildSlabs.length > 0) {
              // Delete all unsold child slabs of this parent
              const [result] = await db.execute<ResultSetHeader>(
                "DELETE FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0)",
                [parentId]
              );
            }
          }
        }
      }
      
      // Mark slabs as unsold (this will now only affect slabs that weren't completely deleted)
      await db.execute(
        `UPDATE slab_inventory 
         SET sale_id = NULL, price = NULL, square_feet = NULL, notes = NULL 
         WHERE sale_id = ?`,
        [saleId]
      );
      
      await db.execute(
        `UPDATE sinks 
         SET sale_id = NULL, price = NULL, is_deleted = 0 
         WHERE sale_id = ?`,
        [saleId]
      );
      
      await db.execute(
        `UPDATE sales SET cancelled_date = NOW() WHERE id = ?`,
        [saleId]
      );
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "All items returned to stock successfully"));
      
      return redirect(`/employee/stones/slabs/${stoneId}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    else if (intent === "sale-info-update") {
      const customer_name = formData.get("customer_name") as string;
      const seller_id = parseInt(formData.get("seller_id") as string, 10);
      const notes = formData.get("notes") as string;
      const total_square_feet = parseFloat(formData.get("total_square_feet") as string) || 0;
      const sale_date = formData.get("sale_date") as string;
      
      const rawPriceValue = formData.get("price");
      
      // Пробуем несколько подходов для безопасного получения значения
      let price = null; // Начинаем с null, чтобы можно было использовать NULL в SQL
      
      if (rawPriceValue !== null && rawPriceValue !== "") {
        // Стандартный подход через parseFloat
        const parsedPrice = parseFloat(rawPriceValue as string);
        if (!isNaN(parsedPrice)) {
          price = parsedPrice;
        }
      }
      
      if (!customer_name || isNaN(seller_id)) {
        console.error(`[ERROR] Invalid sale info data: customer_name=${customer_name}, seller_id=${seller_id}`);
        throw new Error("Invalid sale info update data");
      }
      
      try {
        // Обновляем данные клиента
        await db.execute(
          `UPDATE customers SET name = ? WHERE id = (
            SELECT customer_id FROM sales WHERE id = ?
          )`,
          [customer_name, saleId]
        );
        
        // Получаем существующие данные продажи для сравнения
        const [existingSale] = await db.execute(
          `SELECT price FROM sales WHERE id = ?`,
          [saleId]
        );
        
        // Создадим отдельные запросы для обновления цены и других полей
        let updateQuery;
        let updateParams;
        
        if (price === null) {
          // Если цена null, установим NULL в базе данных
          updateQuery = `UPDATE sales SET seller_id = ?, notes = ?, square_feet = ?, price = NULL, sale_date = ? WHERE id = ?`;
          updateParams = [seller_id, notes || null, total_square_feet, sale_date, saleId];
        } else {
          // Иначе установим числовое значение
          updateQuery = `UPDATE sales SET seller_id = ?, notes = ?, square_feet = ?, price = ?, sale_date = ? WHERE id = ?`;
          updateParams = [seller_id, notes || null, total_square_feet, price, sale_date, saleId];
        }
        
        
        await db.execute(updateQuery, updateParams);
        
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Success", "Sale information updated successfully"));
        
        return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}`, {
          headers: { "Set-Cookie": await commitSession(session) }
        });
      } catch (dbError) {
        console.error("[DB ERROR] Failed to update sale:", dbError);
        
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Error", "Failed to update sale information: " + (dbError as Error).message, "destructive"));
        
        return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}`, {
          headers: { "Set-Cookie": await commitSession(session) }
        });
      }
    } else if (intent === "create-customer") {
      const customer_name = formData.get("customer_name") as string;
      
      if (!customer_name) {
        throw new Error("Customer name is required");
      }
      
      const [customerResult] = await db.execute<RowDataPacket[]>(
        `INSERT INTO customers (name, company_id) VALUES (?, ?)`,
        [customer_name, user.company_id]
      );
      
      const customerId = (customerResult as any).insertId;
      
      if (!customerId) {
        throw new Error("Failed to create customer");
      }
      
      await db.execute(
        `UPDATE sales SET customer_id = ? WHERE id = ?`,
        [customerId, saleId]
      );
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "Customer created and assigned to sale"));
      
      return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}`, {
        headers: { "Set-Cookie": await commitSession(session) }
      });
    } else if (intent === "select-customer") {
      const customerId = formData.get("customer_id") as string;
      
      if (!customerId) {
        throw new Error("Customer ID is required");
      }
      
      // Get customer details
      const customers = await selectMany<Customer>(
        db,
        `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, user.company_id]
      );
      
      if (customers.length === 0) {
        throw new Error("Customer not found");
      }
      
      // Update the sale with the selected customer
      await db.execute(
        `UPDATE sales SET customer_id = ? WHERE id = ?`,
        [customerId, saleId]
      );
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "Customer assigned to sale"));
      
      return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}`, {
        headers: { "Set-Cookie": await commitSession(session) }
      });
    } else if (intent == "slab-delete") {
      const slabId = formData.get("id") as string;
      await db.execute(
        `UPDATE slab_inventory SET sale_id = NULL, price = NULL, square_feet = NULL, notes = NULL WHERE id = ?`,
        [slabId]
      );
    } else if (intent == "slab-update") {
      const slabId = formData.get("id") as string;
      const notes = formData.get("notes") as string;
      const squareFeet = parseFloat(formData.get("square_feet") as string) || null;
      const fullSlabSold = formData.get("full_slab_sold") === "true";
      
      // Обновляем сам слеб
      await db.execute(
        `UPDATE slab_inventory SET notes = ?, square_feet = ? WHERE id = ?`,
        [notes || null, squareFeet, slabId]
      );
      
      let message = "Slab updated successfully";
      
      // Сначала получаем информацию о всех дочерних слебах
      const [childSlabs] = await db.execute<RowDataPacket[]>(
        `SELECT id, sale_id FROM slab_inventory WHERE parent_id = ?`,
        [slabId]
      );
      
      // Get information about the current slab
      const [slabInfo] = await db.execute<RowDataPacket[]>(
        `SELECT stone_id, bundle, square_feet FROM slab_inventory WHERE id = ?`,
        [slabId]
      );
      
      const stoneId = slabInfo[0]?.stone_id;
      const bundle = slabInfo[0]?.bundle;
      const parentSquareFeet = slabInfo[0]?.square_feet || 0;
      
      if (fullSlabSold) {
        // If fullSlabSold is true, delete unsold child slabs
        if (childSlabs && childSlabs.length > 0) {
          
          // Подсчитываем, сколько дочерних слебов можно удалить (не имеют sale_id)
          const deleteableSlabs = childSlabs.filter(
            s => s.sale_id === null || s.sale_id === 0
          ).length;
          
          // Удаляем только те дочерние слебы, у которых нет sale_id (не проданы)
          const [deleteResult] = await db.execute<ResultSetHeader>(
            `DELETE FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0)`,
            [slabId]
          );
          
          
          if (deleteResult.affectedRows > 0) {
            message = `Slab updated and ${deleteResult.affectedRows} unsold child ${
              deleteResult.affectedRows === 1 ? 'piece was' : 'pieces were'
            } removed`;
          }
        }
      } else {
        // If fullSlabSold is false, check if we need to create a child slab
        const hasUnsoldChildSlabs = childSlabs && childSlabs.some(s => s.sale_id === null || s.sale_id === 0);
        
        if (!hasUnsoldChildSlabs) {
          // Calculate a smaller square footage for the child piece (e.g., 60% of parent)
          const childSquareFeet = parentSquareFeet > 0 ? Math.round(parentSquareFeet * 0.6 * 100) / 100 : null;
          
          // Create a new child slab
          await db.execute(
            `INSERT INTO slab_inventory (stone_id, bundle, parent_id, square_feet) 
             VALUES (?, ?, ?, ?)`,
            [stoneId, bundle, slabId, childSquareFeet]
          );
          
          message = "Slab updated and a new child piece was created";
        }
      }
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", message));
      
      return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleId}${new URL(request.url).search}`, {
        headers: { "Set-Cookie": await commitSession(session) }
      });
    } else if (intent == "sink-delete") {
      const sinkId = formData.get("id") as string;
      await db.execute(
        `UPDATE sinks SET sale_id = NULL, price = NULL, is_deleted = 0 WHERE id = ?`,
        [sinkId]
      );
    } else if (intent == "sink-update") {
      const sinkId = formData.get("id") as string;
      const price = parseFloat(formData.get("price") as string) || null;
      await db.execute(
        `UPDATE sinks SET price = ? WHERE id = ?`,
        [price, sinkId]
      );
    } else if (intent == "sink-add") {
      const sinkTypeId = formData.get("newSinkTypeId") as string;
      let price = parseFloat(formData.get("newSinkPrice") as string) || null;
      if (price === null || price === 0 || price === undefined) {
        const sinkTypeDetails = await selectMany<{retail_price: number}>(
          db,
          `SELECT retail_price FROM sink_type WHERE id = ?`,
          [parseInt(sinkTypeId)]
        );
        
        if (sinkTypeDetails.length > 0) {
          price = sinkTypeDetails[0].retail_price;
        }
      }
      
      const availableSinks = await selectMany<{id: number}>(
        db,
        `SELECT id FROM sinks WHERE sink_type_id = ? AND sale_id IS NULL AND is_deleted = 0 LIMIT 1`,
        [parseInt(sinkTypeId)]
      );
      const sinkId = availableSinks[0].id;
      
      await db.execute(
        `UPDATE sinks SET sale_id = ?, price = ?, is_deleted = 1 WHERE id = ?`,
        [saleId, price, sinkId]
      );
    }
    const session = await getSession(request.headers.get("Cookie"));
    
    if (intent === "slab-delete" || intent === "sink-delete") {
      session.flash("message", toastData("Success", "Item removed from sale"));
      return redirect(`/employee/stones/slabs/${params.stone}/edit/${saleId}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    
    session.flash("message", toastData("Success", "Sale updated successfully"));
    
    return redirect(`/employee/stones/slabs/${params.stone}/edit/${saleId}`, {
      headers: { "Set-Cookie": await commitSession(session) }
    });
    
  } catch (error) {
    console.error("Error updating sale:", error);
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to update sale", "destructive"));
    
    return redirect(`/employee/stones/slabs/${params.stone}/edit/${saleId}`, {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  } 
}

function SlabEdit({ slab }: { slab: SaleSlab }) {
  const [fullSlabSold, setFullSlabSold] = useState(!slab.has_children);
  const form = useForm<SlabFormData>({
    resolver: slabsResolver,
    defaultValues: {
      notes: slab.notes || "",
      square_feet: slab.square_feet || 0,
      full_slab_sold: !slab.has_children,
    },
  });
  
  return (
    <FormProvider {...form}>
      <Form id={`slabForm_${slab.id}`} method="post">
        <input type="hidden" name="id" value={slab.id} />
        <input type="hidden" name="intent" value="slab-update" />
        <AuthenticityTokenInput />
        
        <div className="flex items-center gap-2">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <InputItem 
                name="Notes to Slab" 
                placeholder="Notes for this specific slab"
                field={field}
                className="flex-grow"
              />
            )}
          />
          <FormField
            control={form.control}
            name="square_feet"
            render={({ field }) => (
              <InputItem 
                name="Square Feet" 
                placeholder="Sqft"
                field={field} 
                type="number"
                className="w-25"
              />
            )}
          />
          
          <div className="flex flex-col">
            <FormField
              control={form.control}
              name="full_slab_sold"
              render={({ field }) => (
                <div className="flex items-center gap-1 mt-6">
                  <Switch
                    id={`full_slab_sold_${slab.id}`}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      setFullSlabSold(checked);
                    }}
                  />
                  <Label 
                    htmlFor={`full_slab_sold_${slab.id}`} 
                    className="text-xs font-medium text-gray-700 whitespace-nowrap ml-2"
                  >
                    Full Slab sold
                  </Label>
                </div>
              )}
            />
          </div>
        </div>
        <input 
          type="hidden" 
          name="full_slab_sold" 
          value={fullSlabSold ? "true" : "false"} 
        />
      </Form>
    </FormProvider>
  )
}

function SinkEdit({ sink }: { sink: SaleSink }) {
  const form = useForm<SinkFormData>({
    resolver: sinksResolver,
    defaultValues: {
      sink_type_id: sink.sink_type_id,
      price: sink.price,
    },
  });
  return (
    <FormProvider {...form}>
      <Form method="post" className="flex items-center gap-2 -mb-6">
        <input type="hidden" name="id" value={sink.id} />
        <input type="hidden" name="intent" value="sink-update" />
        <AuthenticityTokenInput />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <InputItem name="Price" className="w-full" field={field} />
          )}
        />
        <LoadingButton type="submit" className="ml-auto" loading={form.formState.isSubmitting}>
          Save
        </LoadingButton>
      </Form>
    </FormProvider>
  )
}

function SinkAdd({ availableSinks }: { availableSinks: Sink[] }) {
  const form = useForm<SinkAddFormData>({
    resolver: sinkAddResolver,
    defaultValues: {
      sink_type_id: "",
      price: undefined,
    },
  });
  
  return (
    <FormProvider {...form}>
      <Form method="post">
        <input type="hidden" name="intent" value="sink-add" />
        <AuthenticityTokenInput />
        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-3">
            <FormField
              control={form.control}
              name="sink_type_id"
              render={({ field }) => (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sink</label>
                  <select
                    {...field}
                    name="newSinkTypeId"
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select a sink</option>
                    {availableSinks.map(sink => (
                      <option key={sink.id} value={sink.id} data-price={sink.retail_price}>
                        {sink.name} - ${sink.retail_price}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.sink_type_id && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.sink_type_id.message}</p>
                  )}
                </div>
              )}
            />
          </div>
          
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                  <input
                    {...field}
                    type="number"
                    name="newSinkPrice"
                    placeholder="Auto"
                  
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            />
          </div>
          <div className="mt-5">
          <LoadingButton type="submit" loading={form.formState.isSubmitting}>
            Add Sink
          </LoadingButton>
        </div>
        </div>
      
      </Form>
    </FormProvider>
  );
}

function SaleInfoEdit({ sale, sellers }: { sale: SaleDetails, sellers: {id: number, name: string}[] }) {
  const [showUnsellConfirm, setShowUnsellConfirm] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [customerName, setCustomerName] = useState(sale.customer_name);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const fetcher = useFetcher();
  const customerForm = useForm<CustomerFormData>({
    resolver: customerResolver,
    defaultValues: {
      customer_name: "",
    },
  });
  
  const saleInfoForm = useForm<SaleInfoFormData>({
    resolver: saleInfoResolver,
    defaultValues: {
      customer_name: sale.customer_name,
      seller_id: sale.seller_id,
      notes: sale.notes || "",
      total_square_feet: sale.square_feet || 0,
      price: sale.price || undefined,
      sale_date: new Date(sale.sale_date).toISOString().split('T')[0]
    },
  });
  
  const handleFormSubmit = () => {
    const formValues = saleInfoForm.getValues();
    
    const formData = new FormData();
    formData.append("intent", "sale-info-update");
    formData.append("customer_name", String(formValues.customer_name));
    formData.append("seller_id", String(formValues.seller_id));
    formData.append("notes", formValues.notes || "");
    formData.append("total_square_feet", String(formValues.total_square_feet || 0));
    formData.append("price", String(formValues.price));
    formData.append("sale_date", formValues.sale_date);
    
    // Add CSRF token from hidden input
    const csrfToken = document.querySelector('input[name="csrf"]')?.getAttribute('value');
    if (csrfToken) {
      formData.append("csrf", csrfToken);
    }
    
    fetcher.submit(formData, { method: "post" });
  };
  
  useEffect(() => {
    if (showCreateCustomer) {
      const fetchData = async () => {
        try {
          const response = await fetch('/api/customers/search?term=' + encodeURIComponent(searchTerm));
          if (response.ok) {
            const data = await response.json();
            setCustomers(data.customers || []);
          }
        } catch (error) {
          console.error('Error fetching customers:', error);
        }
      };
      
      fetchData();
    }
  }, [showCreateCustomer, searchTerm]);

  const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    saleInfoForm.setValue("customer_name", customer.name);
    
    const formData = new FormData();
    formData.append("intent", "select-customer");
    formData.append("customer_id", customer.id.toString());
    fetcher.submit(formData, { method: "post" });
    
    setShowCreateCustomer(false);
  };
  
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.customer_name) {
      setCustomerName(fetcher.data.customer_name);
      saleInfoForm.setValue("customer_name", fetcher.data.customer_name);
    }
  }, [fetcher.data, saleInfoForm]);
  
  return (
    <div className="mb-6">
      <FormProvider {...saleInfoForm}>
        <Form method="post">
          <input type="hidden" name="intent" value="sale-info-update" />
          <AuthenticityTokenInput />
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex gap-2">
              <div className="w-2/5">
                <FormField
                  control={saleInfoForm.control}
                  name="customer_name"
                  render={({ field }) => (
                    <div>
                      <div className="flex gap-2">
                        <InputItem
                          name="Customer"
                          placeholder="Customer name"
                          field={{
                            ...field,
                            value: customerName,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                              setCustomerName(e.target.value);
                              field.onChange(e);
                            }
                          }}
                          formClassName="flex-grow mb-0"
                        />
                        <Button 
                          type="button" 
                          variant="blue" 
                          className="px-2 py-2 h-[38px] border border-gray-300 mt-6"
                          onClick={() => setShowCreateCustomer(true)}
                        >
                          <span className="text-sm">+</span>
                        </Button>
                      </div>
                    </div>
                  )}
                />
              </div>
              
              <div className="w-2/5">
                <FormField
                  control={saleInfoForm.control}
                  name="seller_id"
                  render={({ field }) => (
                    <SelectInput
                      field={field}
                      placeholder="Select a seller"
                      name="Seller"
                      options={sellers.map((seller) => {
                        return {
                          key: String(seller.id),
                          value: seller.name,
                        };
                      })}
                    />
                  )}
                />
              </div>
              <div className="w-1/5">
                <FormField
                  control={saleInfoForm.control}
                  name="sale_date"
                  render={({ field }) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                      <input
                        {...field}
                        type="date"
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                />
              </div>
            </div>
            
            <div className="col-span-2 flex gap-2">
              <div className="w-5/8">
                <FormField
                  control={saleInfoForm.control}
                  name="notes"
                  render={({ field }) => (
                    <InputItem
                      formClassName="mb-0"
                      name="Notes to Sale"
                      placeholder="Notes for entire sale"
                      field={field}
                    />
                  )}
                />
              </div>
              
              <div className="w-3/8 flex gap-2">
                <div className="flex-1">
                  <FormField
                    control={saleInfoForm.control}
                    name="total_square_feet"
                    render={({ field }) => (
                      <InputItem
                        formClassName="mb-0"
                        name="Total Sqft"   
                        field={field}
                        type="number"
                      />
                    )}
                  />
                </div>
                <div className="flex-1 w-full">
                  <FormField
                    control={saleInfoForm.control}
                    name="price"
                    render={({ field }) => (
                      <InputItem
                        name="Price"
                        placeholder="Enter price"
                        field={field}
                        formClassName="mb-0"
                        type="number"
                      />
                    )}
                  />
                </div>
              </div>
            </div>
            
            <div className="col-span-2 flex items-end justify-end gap-2 mt-2">
              <Button
                type="button"
                onClick={handleFormSubmit}
              >
                Save Changes
              </Button>
              
              <Button
                type="button"
                variant="destructive"
                className="py-2 px-4"
                onClick={() => setShowUnsellConfirm(true)}
              >
                Unsell
              </Button>
            </div>
          </div>
        </Form>
      </FormProvider>
      
      <Dialog open={showUnsellConfirm} onOpenChange={setShowUnsellConfirm}>
        <DialogContent className="bg-white rounded-lg p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Confirm Return to Stock
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to return all items from this sale back to stock? 
              This will reset all slabs and sinks that were part of this sale.
            </p>
          </div>
          
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowUnsellConfirm(false)}
            >
              Cancel
            </Button>
            
            <Form method="post">
              <input type="hidden" name="intent" value="sale-unsell" />
              <AuthenticityTokenInput />
              <Button 
                type="submit"
                variant="destructive"
              >
                Confirm Unsell
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
        <DialogContent className="bg-white rounded-lg p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add Existing Customer
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Customers</label>
              <input
                type="text"
                value={searchTerm}
                onChange={handleCustomerSearch}
                placeholder="Type to search..."
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
              {customers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No customers found</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {customers.map(customer => (
                    <li 
                      key={customer.id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                      onClick={() => selectCustomer(customer)}
                    >
                      {customer.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                type="button"
                onClick={() => setShowCreateCustomer(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EditSale() {
  const { sale, slabs, sinks, availableSinks, sellers } = useLoaderData<typeof loader>();
  const [deleteSlabId, setDeleteSlabId] = useState<number | null>(null);
  const [deleteSinkId, setDeleteSinkId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  const navigation = useNavigation();
  const fetcher = useFetcher();
  
  useEffect(() => {
    if (navigation.state === "loading" || navigation.state === "idle") {
      setDeleteSlabId(null);
      setDeleteSinkId(null);
    }
  }, [navigation.state]);
  
  // Refresh the page when the fetcher completes
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      // Refresh the data
      window.location.reload();
    }
  }, [fetcher.state, fetcher.data]);

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setDeleteSlabId(null);
      setDeleteSinkId(null);
    }
  };
  
  const handleDialogChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };
  
  const hasSingleSlab = slabs.length === 1;
  
  const formattedDate = new Date(sale.sale_date).toLocaleDateString();
  const isSubmittingFetched = useNavigation().state !== "idle" || fetcher.state !== "idle";
  
  return (
    <Dialog
      open={true}
      onOpenChange={handleDialogChange}
    >
      <DialogContent className="bg-white rounded-lg pt-4 px-4 shadow-lg text-gray-800 overflow-y-auto max-h-[85vh] max-w-2xl">
        <DialogHeader className="mb-3 pb-2 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Edit Sale #{sale.id}
          </DialogTitle>
        </DialogHeader>
        
        <SaleInfoEdit sale={sale} sellers={sellers} />
        
        <Tabs defaultValue="slabs" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="slabs" className="data-[state=active]:bg-blue-100">
              Slabs ({slabs.length})
            </TabsTrigger>
            <TabsTrigger value="sinks" className="data-[state=active]:bg-blue-100">
              Sinks ({sinks.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="slabs" className="max-h-[40vh] overflow-y-auto rounded-md bg-gray-50 p-3 shadow-inner">
            {slabs.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No slabs in this sale</p>
            ) : (
              <div className="space-y-3">
                {slabs.map((slab, index) => (
                  <div key={slab.id} className={`p-3 rounded-md border shadow-sm ${slab.cut_date ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}>
                    <input type="hidden" name="slabId" value={slab.id} />
                    
                    <div className="flex justify-between">
                      <span className="font-medium text-sm text-gray-800">{slab.stone_name} - {slab.bundle}</span>
                      
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          onClick={() => {
                            const form = document.getElementById(`slabForm_${slab.id}`) as HTMLFormElement;
                            if (form) {
                              // Ensure CSRF token is present in the form before submitting
                              const csrf = document.querySelector('input[name="csrf"]');
                              if (csrf && !form.querySelector('input[name="csrf"]')) {
                                const csrfInput = csrf.cloneNode(true);
                                form.appendChild(csrfInput);
                              }
                              form.submit();
                            }
                          }}
                        >
                          Save
                        </Button>
                        <Button variant="destructive" disabled={hasSingleSlab} onClick={() => setDeleteSlabId(slab.id)}>Delete</Button>
                      </div>
                      {deleteSlabId === slab.id && (
                        <DeleteRow 
                          handleChange={handleDialogClose}
                          title='Delete slab'
                          description={`Are you sure you want to delete ${slab.stone_name} - ${slab.bundle}?`}
                          intent="slab-delete"
                          id={slab.id}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center">
                      <SlabEdit slab={slab}/>
                      {!slab.cut_date ? (
                        <fetcher.Form method="post" className="ml-auto">
                          <AuthenticityTokenInput />
                          <input type="hidden" name="intent" value="cut-slab" />
                          <input type="hidden" name="slabId" value={slab.id} />
                          <Button type="submit" variant="blue">
                            Cut Slab
                          </Button>
                        </fetcher.Form>
                      ) : (
                        <Button className="ml-auto" variant="blue" disabled>
                          Already Cut
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="sinks" className="bg-gray-50 rounded-md p-3 shadow-inner">
            <div className="max-h-[25vh] overflow-y-auto mb-4">
                <div className="space-y-3">
                  {sinks.map((sink, index) => (
                    <div key={sink.id} className={`p-3 rounded-md border shadow-sm ${sink.is_deleted === 1 ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}>
                      <input type="hidden" name="sinkId" value={sink.id} />
                      <input type="hidden" name="sinkTypeId" value={sink.sink_type_id} />
                      
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm text-gray-800">{sink.name}</span>
                        <Button variant="destructive" onClick={() => setDeleteSinkId(sink.id)}>Delete</Button>
                        {deleteSinkId === sink.id && (
                          <DeleteRow
                            handleChange={handleDialogClose}
                            title='Delete sink'
                            description={`Are you sure you want to delete ${sink.name}?`}
                            intent="sink-delete"
                            id={sink.id}
                          />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div className="col-span-1">
                          <SinkEdit sink={sink}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
            
            <div className="mt-4 p-3 border border-blue-100 rounded-md bg-blue-50 shadow-sm">
              <h4 className="text-sm font-medium mb-2 text-blue-800">Add New Sink</h4>
              
              <SinkAdd availableSinks={availableSinks}/>
            </div>
          </TabsContent>
        </Tabs>
        <Outlet />
      </DialogContent>
    </Dialog>
  );
} 
