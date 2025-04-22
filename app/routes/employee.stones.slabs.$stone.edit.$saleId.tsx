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
  Params,
  data
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
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
import { csrf } from "~/utils/csrf.server";
import { RowDataPacket } from "mysql2";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import React, { useRef, useState, useEffect } from "react";

interface SaleDetails {
  id: number;
  customer_id: number;
  customer_name: string;
  sale_date: string;
  seller_id: number;
  seller_name: string;
}

interface SaleSlab {
  id: number;
  stone_id: number;
  bundle: string;
  stone_name: string;
  is_cut: number;
  notes: string | null;
  square_feet: number | null;
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
})

type SlabFormData = z.infer<typeof slabSchema>;
const slabsResolver = zodResolver(slabSchema);

const sinkSchema = z.object({
  sink_type_id: z.coerce.number(),
  price: z.coerce.number(),
})

type SinkFormData = z.infer<typeof sinkSchema>;
const sinksResolver = zodResolver(sinkSchema);

const schema = z.object({
  sinks: z.array(
    z.object({
      is_deleted: z.boolean().default(false),
    })
  ),
  new_sinks: z.array(
    z.object({
      sink_type_id: z.string().optional(),
      price: z.coerce.number().optional(),
    })
  ).optional(),
});

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
      s.sale_date, s.seller_id, u.name as seller_name
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
      slab_inventory.is_cut, slab_inventory.notes, slab_inventory.square_feet
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.sale_id = ? AND (slab_inventory.is_cut = 0 OR slab_inventory.is_cut IS NULL)
     ORDER BY slab_inventory.id`,
    [saleId]
  );
  
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
  
  const sellers = await selectMany<{id: number, name: string}>(
    db,
    `SELECT id, name FROM users WHERE company_id = ? ORDER BY name ASC`,
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
  } catch (error) {
    console.error("CSRF validation error:", error);
    return { error: "Invalid CSRF token" };
  }
  
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  
  
  try {
    if (intent === "sale-unsell") {
   
      
      await db.execute(
        `UPDATE slab_inventory 
         SET sale_id = NULL, notes = NULL, price = NULL, square_feet = NULL 
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
        `UPDATE sales SET status = 'cancelled' WHERE id = ?`,
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
      const seller_id = parseInt(formData.get("seller_id") as string);
    
      
      if (!customer_name || isNaN(seller_id)) {
        console.error(`[ERROR] Invalid sale info data: customer_name=${customer_name}, seller_id=${seller_id}`);
        throw new Error("Invalid sale info update data");
      }
      
      try {
        await db.execute(
          `UPDATE customers SET name = ? WHERE id = (
            SELECT customer_id FROM sales WHERE id = ?
          )`,
          [customer_name, saleId]
        );
        
        await db.execute(
          `UPDATE sales SET seller_id = ? WHERE id = ?`,
          [seller_id, saleId]
        );
        
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Success", "Sale information updated successfully"));
        
        return data({ success: true }, {
          headers: { "Set-Cookie": await commitSession(session) },
        });
      } catch (dbError) {
        
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
      
      return data({ success: true, customer_id: customerId, customer_name }, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    } else if (intent == "slab-delete") {
      const slabId = formData.get("id") as string;
      await db.execute(
        `UPDATE slab_inventory SET sale_id = NULL, notes = NULL, price = NULL, square_feet = NULL WHERE id = ?`,
        [slabId]
      );
    } else if (intent == "slab-update") {
      const slabId = formData.get("id") as string;
      const notes = formData.get("notes") as string;
      const squareFeet = parseFloat(formData.get("square_feet") as string) || null;
      await db.execute(
        `UPDATE slab_inventory 
         SET notes = ?, square_feet = ? 
         WHERE id = ?`,
        [notes, squareFeet, slabId]
      );
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
    
    return data({ success: true }, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
    
  } catch (error) {
    console.error("Error updating sale:", error);
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to update sale", "destructive"));
    
    return data({ success: false }, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } 
}

function SlabEdit({ slab }: { slab: SaleSlab }) {
  const form = useForm<SlabFormData>({
    resolver: slabsResolver,
    defaultValues: {
      notes: slab.notes || "",
      square_feet: slab.square_feet || 0,
    },
  });
  return (
    <FormProvider {...form}>
      <Form id="customerForm" method="post" className="flex items-center gap-2">
        <input type="hidden" name="id" value={slab.id} />
        <input type="hidden" name="intent" value="slab-update" />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <InputItem name="Notes" field={field} />
          )}
        />
        <FormField
          control={form.control}
          name="square_feet"
          render={({ field }) => (
            <InputItem name="Square Feet" field={field} />
          )}
        />
        <LoadingButton type="submit" loading={form.formState.isSubmitting}>
          Save
        </LoadingButton>
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
                    step="1"
                    min="0"
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
  const fetcher = useFetcher();
  const customerForm = useForm<CustomerFormData>({
    resolver: customerResolver,
    defaultValues: {
      customer_name: "",
    },
  });
  
  const onSubmitCustomer = (data: CustomerFormData) => {
    const formData = new FormData();
    formData.append("intent", "create-customer");
    formData.append("customer_name", data.customer_name);
    fetcher.submit(formData, { method: "post" });
    setShowCreateCustomer(false);
    customerForm.reset();
  };
  
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.customer_name) {
      setCustomerName(fetcher.data.customer_name);
    }
  }, [fetcher.data]);
  
  return (
    <div className="mb-6">
      <Form method="post">
        <input type="hidden" name="intent" value="sale-info-update" />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <div className="flex items-center">
              <div className="relative flex-grow">
                <input 
                  type="text" 
                  name="customer_name" 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <Button 
                type="button" 
                variant="outline" 
                className="ml-2 px-2 py-2 h-[38px] border border-gray-300"
                onClick={() => setShowCreateCustomer(true)}
              >
                <span className="text-lg">+</span>
              </Button>
            </div>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
            <div className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-50 shadow-inner">
              {new Date(sale.sale_date).toLocaleDateString()}
            </div>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Seller</label>
            <select 
              name="seller_id" 
              defaultValue={sale.seller_id.toString()}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sellers.map(seller => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
            <LoadingButton
              type="submit"
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors flex-1" 
              loading={false}
            >
              Save Changes
            </LoadingButton>
            
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
      
      {/* Confirm Unsell Dialog */}
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
      
      {/* Create Customer Dialog */}
      <Dialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
        <DialogContent className="bg-white rounded-lg p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Create New Customer
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-4">
            <FormProvider {...customerForm}>
              <form onSubmit={customerForm.handleSubmit(onSubmitCustomer)}>
                <FormField
                  control={customerForm.control}
                  name="customer_name"
                  render={({ field }) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <input
                        {...field}
                        type="text"
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {customerForm.formState.errors.customer_name && (
                        <p className="text-xs text-red-500 mt-1">{customerForm.formState.errors.customer_name.message}</p>
                      )}
                    </div>
                  )}
                />
                
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => setShowCreateCustomer(false)}
                  >
                    Cancel
                  </Button>
                  
                  <LoadingButton 
                    type="submit"
                    loading={customerForm.formState.isSubmitting || fetcher.state !== "idle"}
                  >
                    Create Customer
                  </LoadingButton>
                </div>
              </form>
            </FormProvider>
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
  
  useEffect(() => {
    if (navigation.state === "loading" || navigation.state === "idle") {
      setDeleteSlabId(null);
      setDeleteSinkId(null);
    }
  }, [navigation.state]);
  
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
  const fetcher = useFetcher();
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
                  <div key={slab.id} className={`p-3 rounded-md border shadow-sm ${slab.is_cut === 1 ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}>
                    <input type="hidden" name="slabId" value={slab.id} />
                    
                    <div className="flex justify-between">
                      <span className="font-medium text-sm text-gray-800">{slab.stone_name} - {slab.bundle}</span>
                      
                      <Button variant="destructive" disabled={hasSingleSlab} onClick={() => setDeleteSlabId(slab.id)}>Delete</Button>
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
                      <Link to={`cut/${slab.id}/${location.search}`}>
                        <Button className="ml-2" variant="blue">
                          Cut Slab
                        </Button>
                      </Link>
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
