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
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { coerceNumber, coerceNumberRequired, StringOrNumber } from "~/schemas/general";
import { Switch } from "~/components/ui/switch";

interface Sink {
  id: number;
  name: string;
  type: string;
}

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customer_id: z.coerce.number().optional(),
  sink_type_id: z.preprocess(val => String(val), z.string().optional()),
  notes_to_slab: StringOrNumber,
  notes_to_sale: StringOrNumber,
  total_square_feet: coerceNumberRequired,
  price: coerceNumber,
  is_full_slab_sold: z.boolean().default(false)
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
      `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
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
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?)`,
      [
        customerId,
        user.id, 
        user.company_id,
        data.notes_to_sale || null,
        data.total_square_feet || 0,
        data.price || 0
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
  
    if (data.is_full_slab_sold) {
      await db.execute(
        `UPDATE slab_inventory SET sale_id = ? WHERE id = ?`,
        [saleId, slabId]
      );
    } else {
      await db.execute<ResultSetHeader>(
        `INSERT INTO slab_inventory 
         (stone_id, bundle, length, width, url, parent_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          slabDimensions[0].stone_id,
          slabDimensions[0].bundle,
          slabDimensions[0].length,
          slabDimensions[0].width,
          slabDimensions[0].url,
          slabId
        ]
      );
      
      await db.execute(
        `UPDATE slab_inventory SET sale_id = ? WHERE id = ?`,
        [saleId, slabId]
      );

      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Info", "Created a copy of partially sold slab"));
      return redirect(`..${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    
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
    
    const allSales = await selectMany<{
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
       ORDER BY s.sale_date DESC`,
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
    
    return { user, sinks, allSales, customers };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export default function SlabSell() {
  const { sinks, allSales, customers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const params = useParams();
  const location = useLocation();
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<{id: number, name: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      is_full_slab_sold: false
    }
  });
  const fullSubmit = useFullSubmit(form);

  // Focus the customer name input when the component mounts
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (customerInputRef.current) {
        customerInputRef.current.focus();
      }
    }, 50);
    
    return () => clearTimeout(timeout);
  }, []);

  // Watch for customer name changes to provide real-time suggestions
  useEffect(() => {
    const customerName = form.watch("name");
    
    if (customerName && customerName.length >= 2 && !isExistingCustomer) {
      const fetchCustomers = async () => {
        try {
          const response = await fetch('/api/customers/search?term=' + encodeURIComponent(customerName));
          if (response.ok) {
            const data = await response.json();
            // Limit to only the top 1 customer
            const limitedCustomers = (data.customers || []).slice(0, 1);
            setCustomerSuggestions(limitedCustomers);
            setShowSuggestions(limitedCustomers.length > 0);
          }
        } catch (error) {
          console.error('Error fetching customer suggestions:', error);
          setCustomerSuggestions([]);
          setShowSuggestions(false);
        }
      };
      
      fetchCustomers();
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [form.watch("name"), isExistingCustomer]);

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
    setShowSuggestions(false);
  };

  const handleSelectSuggestion = (customer: {id: number, name: string}) => {
    handleSelectCustomer(customer.name, customer.id);
  };

  const filteredSales = allSales.filter(sale => 
    sale.customer_name.toLowerCase().includes(saleSearch.toLowerCase())
  );

  // Handle blur event to hide suggestions
  const handleInputBlur = (e: React.FocusEvent) => {
    // Small delay to allow clicking on suggestions
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
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
                          disabled: isExistingCustomer,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            field.onChange(e);
                            if (isExistingCustomer) {
                              setIsExistingCustomer(false);
                              form.setValue("customer_id", undefined);
                            }
                          },
                          onBlur: (e) => {
                            field.onBlur();
                            handleInputBlur(e);
                          }
                        }}
                        ref={customerInputRef}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 mr-1 flex items-center gap-1">
                      <span>Existing</span>
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-blue-200 p-0.5"
                        onClick={() => {
                          setIsExistingCustomer(false);
                          form.setValue("customer_id", undefined);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div 
                      ref={suggestionsRef} 
                      className="absolute z-10 w-full -mt-4 max-h-20 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      <ul className="py-1 divide-y divide-gray-200">
                        {customerSuggestions.map((customer) => (
                          <li 
                            key={customer.id}
                            className="px-2 py-0.5 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectSuggestion(customer)}
                          >
                            {customer.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
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
                        className="mb-0"
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
                <div className="flex flex-row gap-2 w-full">
                  <FormField
                    control={form.control}
                    name="total_square_feet"
                    render={({ field }) => (
                      <InputItem
                        name={"Total Sqft"}
                        placeholder={"Total Sqft"}
                        field={field}
                        formClassName="mb-0"
                      />
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <InputItem
                        name={"Price"}
                        placeholder={"Enter price"}
                        field={field}
                        formClassName="mb-0"
                      />
                    )}
                  />
                </div>
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
                            
              <div className="flex items-center space-x-2 mt-4">
                <FormField
                  control={form.control}
                  name="is_full_slab_sold"
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="is_full_slab_sold"
                      />
                      <label
                        htmlFor="is_full_slab_sold"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Full Slab Sold
                      </label>
                    </>
                  )}
                />
              </div>
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
              <div className="relative mb-4">
                <Input
                  placeholder="Search sales by customer..."
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredSales.length === 0 ? (
                  <p className="text-center py-4">No sales found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredSales.map(sale => (
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
      </DialogContent>
    </Dialog>
  );
}
