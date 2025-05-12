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
import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

interface Sink {
  id: number;
  name: string;
  type: string;
}

const customerSchema = z.object({
  name: z.union([z.string(), z.number()])
    .refine(val => val !== undefined && val !== null && val.toString().trim() !== "", "Customer name is required")
    .transform(val => String(val)),
  customer_id: z.coerce.number().optional(),
  sink_type_id: z.preprocess(val => String(val), z.string().optional()),
  notes_to_slab: z.union([z.string(), z.number(), z.null()])
    .transform(val => val ? String(val) : "")
    .optional(),
  notes_to_sale: z.union([z.string(), z.number(), z.null()])
    .transform(val => val ? String(val) : "")
    .optional(),
  total_square_feet: z.coerce.number().default(0),
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
    
    let customerId: number;
    
    if (data.customer_id) {
      customerId = data.customer_id;
      
      const [customerVerify] = await db.execute<RowDataPacket[]>(
        `SELECT id FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, user.company_id]
      );
      
      if (!customerVerify || customerVerify.length === 0) {
        throw new Error("Customer not found");
      }
    } else {
      const [customerResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO customers (name, company_id) VALUES (?, ?)`,
        [
          data.name,
          user.company_id
        ]
      );
      customerId = customerResult.insertId;
    }
    
    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL)`,
      [
        customerId,
        user.id, 
        user.company_id,
        data.notes_to_sale || null,
        data.total_square_feet || 0
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
      `UPDATE slab_inventory SET sale_id = ? WHERE id = ?`,
      [saleId, slabId]
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
      notes: string | null;
      square_feet: number;
    }>(
      db,
      `SELECT s.id, c.name as customer_name, s.sale_date, s.notes, s.square_feet
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.company_id = ? AND s.cancelled_date IS NULL
       ORDER BY s.sale_date DESC
       LIMIT 20`,
      [user.company_id]
    );
    
    const customers = await selectMany<{
      id: number;
      name: string;
    }>(
      db,
      `SELECT id, name FROM customers 
       WHERE company_id = ? 
       ORDER BY id DESC
       LIMIT 100`,
      [user.company_id]
    );
    
    return { user, sinks, recentSales, customers };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SlabSell() {
  const { sinks, recentSales, customers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const [showExistingCustomers, setShowExistingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const params = useParams();
  const location = useLocation();
  
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      name: "",
      customer_id: undefined,
      sink_type_id: "",
      notes_to_slab: "",
      total_square_feet: 0,
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

  const handleSelectCustomer = (customerName: string, customerId: number) => {
    form.setValue("name", customerName);
    form.setValue("customer_id", customerId);
    setIsExistingCustomer(true);
    setShowExistingCustomers(false);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

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
                <div className="flex-grow relative">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <InputItem
                        inputAutoFocus={true}
                        name={"Customer Name"}
                        placeholder={"Enter customer name"}
                        field={{
                          ...field,
                          disabled: isExistingCustomer
                        }}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 mr-1">
                      Existing
                    </div>
                  )}
                </div>
                <Button 
                  size="sm" 
                  className="h-9 mt-7 whitespace-nowrap mt-[24.5px]"
                  type="button"
                  variant="outline"
                  onClick={() => setShowExistingCustomers(true)}
                >
                  Existing Customer
                </Button>
              </div>
              
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <input type="hidden" {...field} />
                )}
              />
              
              <div className="flex flex-row gap-2">
                <FormField  
                  control={form.control}
                  name="sink_type_id"
                  render={({ field }) => {
                    return (
                      <SelectInput
                        field={field}
                        placeholder="Select a Sink"
                        name="Sink"
                        options={sinks.map((sink) => {
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
                  name="total_square_feet"
                  render={({ field }) => (
                    <InputItem
                      name={"Total Square Feet"}
                      placeholder={"Total Square Feet"}
                      field={field}
                    />
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes_to_sale"
                render={({ field }) => (
                  <InputItem
                    name={"Notes"}
                    placeholder={"Notes to Sale"}
                    field={field}
                  />
                )}
              />
            </div>
          
            <DialogFooter className="flex flex-col sm:flex-row gap-2 items-center justify-between mt-4">
              <Button 
                type="button"
                variant="blue"
                className="sm:order-1 order-2 sm:ml-0 ml-auto"
                onClick={() => setShowExistingSales(true)}
              >
                Add to Existing Sale
              </Button>
              <LoadingButton loading={isSubmitting} className="sm:order-2 order-1 sm:ml-auto ml-0">
                Create Sale
              </LoadingButton>
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
                          {sale.notes && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Notes:</span> {sale.notes}
                            </div>
                          )}
                          {sale.square_feet > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-semibold">Total Square Feet:</span> {sale.square_feet}
                            </div>
                          )}
                        </div>
                        
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {showExistingCustomers && (
          <Dialog open={showExistingCustomers} onOpenChange={setShowExistingCustomers}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select Existing Customer</DialogTitle>
              </DialogHeader>
              <div className="relative mb-4">
                <Input
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <p className="text-center py-4">No customers found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map(customer => (
                      <div 
                        key={customer.id} 
                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectCustomer(customer.name, customer.id)}
                      >
                        <div className="font-medium">{customer.name}</div>
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
