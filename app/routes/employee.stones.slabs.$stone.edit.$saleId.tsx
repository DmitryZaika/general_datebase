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
import React, { useRef, useState } from "react";

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

type FormData = z.infer<typeof schema>;

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
  
  return { 
    sale,
    slabs,
    sinks,
    availableSinks,
  };
}

/*
async function handleSinks(formData: globalThis.FormData,  saleId: number, companyId: number) {
  const sinkIds = formData.getAll("sinkId") as string[];
  const sinkTypeIds = formData.getAll("sinkTypeId") as string[];
  const sinkPrices = formData.getAll("sinkPrice") as string[];
  const sinkIsDeleted = formData.getAll("sinkIsDeleted") as string[];
  const sinkId = formData.get("sinkId") as string;
  const newSinkTypeIds = formData.getAll("newSinkTypeId") as string[];
  const newSinkPrices = formData.getAll("newSinkPrice") as string[];
 await db.execute(
  `UPDATE sinks SET price = ?, sink_type_id = ? WHERE id = ? AND sale_id = ? AND company_id = ?`,
  [sinkId, saleId, companyId]
);
for (let i = 0; i < sinkIds.length; i++) {
  const id = parseInt(sinkIds[i]);
  const sinkTypeId = parseInt(sinkTypeIds[i]);
  const price = parseFloat(sinkPrices[i]);
  const isDeleted = sinkIsDeleted[i] === "true" ? 1 : 0;
  
  if (isDeleted === 1) {
    await db.execute(
      `UPDATE sinks 
       SET sink_type_id = ?, price = ?, is_deleted = 0, sale_id = NULL 
       WHERE id = ? AND sale_id = ?`,
      [sinkTypeId, price, id, saleId]
    );
  } else {
    await db.execute(
      `UPDATE sinks 
       SET sink_type_id = ?, price = ? 
       WHERE id = ? AND sale_id = ?`,
      [sinkTypeId, price, id, saleId]
    );
  }
}

for (let i = 0; i < newSinkTypeIds.length; i++) {
  const sinkTypeId = newSinkTypeIds[i];
  
  if (sinkTypeId && sinkTypeId !== "") {
    let price = parseFloat(newSinkPrices[i] || "0");
    
    if (price === 0) {
      const [sinkResult] = await db.execute<RowDataPacket[]>(
        `SELECT retail_price FROM sink_type WHERE id = ?`,
        [sinkTypeId]
      );
      
      if (sinkResult && sinkResult.length > 0) {
        price = parseFloat(sinkResult[0].retail_price) || 0;
      }
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
        `UPDATE sinks 
         SET sale_id = ?, price = ?, is_deleted = 1 
         WHERE id = ?`,
        [saleId, price, sinkId]
      );
    } else {
      console.warn(`No available sink found for type ID: ${sinkTypeId}`);
    }
  }
}
}
*/

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
    if (intent == "slab-delete") {
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
    }

    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Sale updated successfully"));
    
    return redirect(`/employee/stones/slabs/${params.stone}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
    
  } catch (error) {
    console.error("Error updating sale:", error);
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to update sale"));
    
      return redirect(`/employee/stones/slabs/${params.stone}/edit/${saleId}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } 
}

function SlabEdit({ slab }: { slab: SaleSlab }) {
  const token = useAuthenticityToken();
  const form = useForm<SlabFormData>({
    resolver: slabsResolver,
    defaultValues: {
      notes: slab.notes || "",
      square_feet: slab.square_feet || 0,
    },
  });

  const fullSubmit = useFullSubmit(form);
  return (
    <FormProvider {...form}>
      <Form id="customerForm" method="post" className="flex items-center gap-2">
        <input type="hidden" name="id" value={slab.id} />
        <input type="hidden" name="intent" value="slab-update" />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <InputItem name="notes" field={field} />
          )}
        />
        <FormField
          control={form.control}
          name="square_feet"
          render={({ field }) => (
            <InputItem name="number" field={field} />
          )}
        />
        <LoadingButton type="submit" loading={form.formState.isSubmitting}>
          Save
        </LoadingButton>
      </Form>
    </FormProvider>
  )
}

export default function EditSale() {
  const { sale, slabs, sinks, availableSinks } = useLoaderData<typeof loader>();
  const [deleteSlab, setDeleteSlab] = useState(false);
  const navigate = useNavigate();
  const submitClickedRef = useRef(false);
  const location = useLocation();
  const handleChange = (open: boolean) => {
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
      onOpenChange={handleChange}
    >
      <DialogContent className="bg-white rounded-lg pt-4 px-4 shadow-lg text-gray-800 overflow-y-auto max-h-[85vh] max-w-2xl">
        <DialogHeader className="mb-3 pb-2 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Edit Sale #{sale.id}
          </DialogTitle>
        </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
              <div className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-50 shadow-inner">
                {sale.customer_name}
              </div>
            </div>
            
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
              <div className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-50 shadow-inner">
                {formattedDate}
              </div>
            </div>
            
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller</label>
              <div className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-50 shadow-inner">
                {sale.seller_name}
              </div>
            </div>
          </div>
          
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
                        
                        <Button variant="destructive" disabled={hasSingleSlab} onClick={() => setDeleteSlab(true)}>Delete</Button>
                        { deleteSlab && (
                          <DeleteRow 
                            handleChange={handleChange}
                            title='Delete slab'
                            description={`Are you sure you want to delete ${name}?`}
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
                              { deleteSlab && (
                                <DeleteRow 
                                  handleChange={handleChange}
                                  title='Delete sink'
                                  description={`Are you sure you want to delete ${name}?`}
                                  intent="sink-delete"
                                  id={sink.id}
                                />
                              )}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                            <input
                              type="number"
                              name="sinkPrice"
                              defaultValue={sink.price}
                              step="1"
                              min="0"
                              className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
              
              <div className="mt-4 p-3 border border-blue-100 rounded-md bg-blue-50 shadow-sm">
                <h4 className="text-sm font-medium mb-2 text-blue-800">Add New Sink</h4>
                
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sink</label>
                    <select
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
                  </div>
                  
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                    <input
                      type="number"
                      name="newSinkQuantity"
                      defaultValue="1"
                      min="1"
                      className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                    <input
                      type="number"
                      name="newSinkPrice"
                      placeholder="Auto"
                      step="1"
                      min="0"
                      className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        <Outlet />
      </DialogContent>
    </Dialog>
  );
} 
