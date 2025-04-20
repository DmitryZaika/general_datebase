import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  useParams,
  useLoaderData,
  useLocation,
} from "react-router";
import { Form, useNavigate } from "react-router";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";
import { useState } from "react";

interface Sink {
  id: number;
  name: string;
  type: string;
}

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  sink_type_id: z.preprocess(val => String(val), z.string().optional()),
  notes: z.union([z.string(), z.number()]).transform(val => val ? String(val) : "").optional(),
  square_feet: z.coerce.number().default(0),
});

type FormData = z.infer<typeof customerSchema>;

const resolver = zodResolver(customerSchema);

export async function action({ request, params }: ActionFunctionArgs) {
  let user;
  try {
    user = await getEmployeeUser(request);
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
  

  
  const slabId = params.slab;
  if (!slabId) {
    return { error: "Slab ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';

  try {    
    const [slabDimensions] = await db.execute<RowDataPacket[]>(
      `SELECT length, width FROM slab_inventory WHERE id = ?`,
      [slabId]
    );
    
    if (!slabDimensions || slabDimensions.length === 0) {
      throw new Error("Slab not found");
    }
    
    const [customerResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO customers (name, company_id) VALUES (?, ?)`,
      [
        data.name,
        user.company_id
      ]
    );
    const customerId = customerResult.insertId;
    
    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, status) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'sold')`,
      [
        customerId,
        user.id, 
        user.company_id
      ]
    );
    
    const saleId = salesResult.insertId;

    if (data.sink_type_id) {
      const sinkTypeId = parseInt(data.sink_type_id as string, 10);
      
      if (!isNaN(sinkTypeId)) {
        const [sinkTypeResult] = await db.execute<RowDataPacket[]>(
          `SELECT retail_price FROM sink_type WHERE id = ?`,
          [sinkTypeId]
        );
        
        let price = 0;
        if (sinkTypeResult && sinkTypeResult.length > 0) {
          price = sinkTypeResult[0].retail_price || 0;
        }
        
        const [availableSinks] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM sinks 
           WHERE sink_type_id = ? 
           AND sale_id IS NULL 
           AND is_deleted = 0 
           LIMIT 1`,
          [sinkTypeId]
        );
        
        if (availableSinks && availableSinks.length > 0) {
          const sinkId = availableSinks[0].id;
          
          await db.execute(
            `UPDATE sinks SET sale_id = ?, is_deleted = 1, price = ? WHERE id = ?`,
            [saleId, price, sinkId]
          );
        }
      }
    }
  

      await db.execute(
      `UPDATE slab_inventory SET sale_id = ?, notes = ?, square_feet = ? WHERE id = ?`,
      [saleId, data.notes || null, data.square_feet || 0, slabId]
    );
    
 
    
    
    
  } catch (error) {
    console.error("Error during sale process: ", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to process sale"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } 

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sale completed successfully"));
  return redirect(`..${searchString}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    
    const sinks = await selectMany<Sink>(
      db,
      `SELECT st.id, st.name, st.type 
       FROM sink_type st
       WHERE st.company_id = ?
       AND EXISTS (
         SELECT 1 
         FROM sinks s 
         WHERE s.sink_type_id = st.id
         AND s.sale_id IS NULL 
         AND s.is_deleted = 0
       )
       ORDER BY st.name ASC`,
      [user.company_id]
    );
    
    
    const recentSales = await selectMany<{
      id: number;
      customer_name: string;
      sale_date: string;
    }>(
      db,
      `SELECT s.id, c.name as customer_name, s.sale_date
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.company_id = ?
       ORDER BY s.sale_date DESC
       LIMIT 20`,
      [user.company_id]
    );
    
    return { user, sinks, recentSales };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SlabSell() {
  const { sinks, recentSales } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const params = useParams();
  const location = useLocation();
  
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: "",
      sink_type_id: "",
      notes: "",
    },
  });
  const fullSubmit = useFullSubmit(form);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };
  
  const handleAddToExistingSale = (saleId: number) => {
    if (!params.slab) return;
    
    navigate(`/employee/stones/slabs/${params.stone}/add-to-sale/${params.slab}/${saleId}${location.search}`);
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post" onSubmit={fullSubmit}>
            <div className="">
              <div className="flex items-start gap-2">
                <div className="flex-grow">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <InputItem
                        inputAutoFocus={true}
                        name={"Customer Name"}
                        placeholder={"Enter customer name"}
                        field={field}
                      />
                    )}
                  />
                </div>
                <Button 
                  size="sm" 
                  className="h-9 mt-7 whitespace-nowrap mt-[24.5px]"
                  type="button"
                  variant="blue"
                  onClick={() => setShowExistingSales(true)}
                >
                  Add to Sale
                </Button>
              </div>
              
              <div className="flex flex-row gap-2">
                <FormField  
                  control={form.control}
                  name="sink_type_id"
                  render={({ field }) => {
                    console.log("SelectInput field value:", field.value);
                    return (
                      <SelectInput
                        field={field}
                        placeholder="Select a Sink"
                        name="Sink"
                        options={sinks.map((sink) => {
                          console.log("Sink option:", { id: sink.id, name: sink.name });
                          return {
                            key: String(sink.id),
                            value: sink.name,
                          };
                        })}
                      />
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="square_feet"
                  render={({ field }) => (
                    <InputItem
                      name={"Square Feet"}
                      placeholder={"Square Feet"}
                      field={field}
                    />
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <InputItem
                    name={"Notes"}
                    placeholder={"Additional notes"}
                    field={field}
                  />
                )}
              />
            </div>
          
            <DialogFooter>
              <LoadingButton loading={isSubmitting}>Complete Sale</LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
        
        {showExistingSales && (
          <Dialog open={showExistingSales} onOpenChange={setShowExistingSales}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select Existing Sale</DialogTitle>
              </DialogHeader>
              <div className="max-h-80 overflow-y-auto">
                {recentSales.length === 0 ? (
                  <p className="text-center py-4">No recent sales found</p>
                ) : (
                  <div className="space-y-2">
                    {recentSales.map(sale => (
                      <div 
                        key={sale.id} 
                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAddToExistingSale(sale.id)}
                      >
                        <div className="font-medium">{sale.customer_name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(sale.sale_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
