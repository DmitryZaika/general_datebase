import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
  useNavigation,
  useNavigate,
  data,
  Outlet,
  Link,
  useLocation,
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { X } from "lucide-react";
import { z } from "zod";

interface Slab {
  id: number;
  bundle: string;
  url: string | null;
  sale_id: number | null;
  width: number;
  length: number;
  cut_date: string | null;
  source_stone_id?: number;
  source_stone_name?: string;
  transaction?: {
    sale_id: number;
    sale_date: string;
    customer_name: string;
    seller_name: string;
    sale_notes?: string;
    slab_notes?: string;
    square_feet?: number;
    sink?: string;
  };
}

const TransactionSchema = z.object({
  slab_id: z.number(),
  sale_id: z.number(),
  sale_date: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? val : val.toISOString()
  ),
  customer_name: z.string(),
  seller_name: z.string(),
  sale_notes: z.string().nullable().optional(),
  slab_notes: z.string().nullable().optional(),
  square_feet: z.coerce.number().default(0),
  sink_names: z.string().nullable().optional(),
});

type Transaction = z.infer<typeof TransactionSchema>;

function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);  
}

function formatSinkList(sinkString: string): string {
  if (!sinkString) return '';
  
  const sinks = sinkString.split(', ');
  const sinkCounts: {[key: string]: number} = {};
  
  sinks.forEach(sink => {
    if (sink) {
      sinkCounts[sink] = (sinkCounts[sink] || 0) + 1;
    }
  });
  
  return Object.entries(sinkCounts)
    .map(([sink, count]) => count > 1 ? `${sink} x ${count}` : sink)
    .join(', ');
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  
  if (isNaN(stoneId)) {
    return forceRedirectError(request.headers, "Invalid stone ID format");
  }
  
  const stone = await selectId<{ id: number; name: string; url: string }>(
    db,
    "SELECT id, name, url FROM stones WHERE id = ?",
    stoneId
  );
  if (!stone) {
    return forceRedirectError(request.headers, "No stone found for given ID");
  }
  
  const slabs = await selectMany<Slab>(
    db,
    "SELECT id, bundle, url, sale_id, width, length, cut_date FROM slab_inventory WHERE stone_id = ? AND cut_date IS NULL",
    [stoneId]
  );
  
  let linkedSlabs: Slab[] = [];
  
  try {
    const stoneLinks = await selectMany<{ 
      source_stone_id: number;
      source_stone_name: string;
    }>(
      db,
      `SELECT 
         stone_slab_links.source_stone_id, 
         s.name as source_stone_name
       FROM stone_slab_links
       JOIN stones s ON stone_slab_links.source_stone_id = s.id
       WHERE stone_slab_links.stone_id = ?
       GROUP BY stone_slab_links.source_stone_id, s.name
       ORDER BY s.name ASC`,
      [stoneId]
    );
    
    for (const link of stoneLinks) {
      const linkedStoneSlabs = await selectMany<Slab>(
        db,
        `SELECT 
           id, bundle, url, sale_id, width, length, cut_date
         FROM slab_inventory 
         WHERE stone_id = ? AND cut_date IS NULL`,
        [link.source_stone_id]
      );
      
      linkedStoneSlabs.forEach(slab => {
        slab.source_stone_id = link.source_stone_id;
        slab.source_stone_name = link.source_stone_name;
      });
      
      linkedSlabs = [...linkedSlabs, ...linkedStoneSlabs];
    }
  } catch (err) {
    console.error("Error fetching linked slabs:", err);
  }
  
  const allSlabs = [...slabs, ...linkedSlabs];
  const soldSlabIds = allSlabs.filter(slab => slab.sale_id).map(slab => slab.id);
  
  if (soldSlabIds.length > 0) {
    const placeholders = soldSlabIds.map(() => '?').join(',');
    
    const sqlQuery = `
      SELECT 
        slab_inventory.id as slab_id,
        sales.id as sale_id,
        sales.sale_date,
        customers.name as customer_name,
        users.name as seller_name,
        sales.notes as sale_notes,
        slab_inventory.notes as slab_notes,
        sales.square_feet,
        (
          SELECT GROUP_CONCAT(sink_type.name SEPARATOR ', ')
          FROM sinks
          JOIN sink_type ON sinks.sink_type_id = sink_type.id
          WHERE sinks.sale_id = sales.id
        ) as sink_names
      FROM 
        sales
      JOIN 
        customers ON sales.customer_id = customers.id
      JOIN 
        users ON sales.seller_id = users.id
      JOIN 
        slab_inventory ON sales.id = slab_inventory.sale_id
      WHERE 
        slab_inventory.id IN (${placeholders})
      ORDER BY
        slab_inventory.id DESC
    `;
    
    const rawTransactions = await selectMany<Record<string, any>>(
      db,
      sqlQuery,
      soldSlabIds
    );
    
    const transactionResults = rawTransactions.map(raw => {
      try {
        const parsed = TransactionSchema.parse(raw);
        return parsed;
      } catch (error) {
        console.error(`Validation error for transaction:`, error);
        return null;
      }
    }).filter(Boolean) as Transaction[];
    
    const transactionsBySlab = transactionResults.reduce((acc, transaction) => {
      if (!acc[transaction.slab_id]) {
        acc[transaction.slab_id] = [];
      }
      acc[transaction.slab_id].push(transaction);
      return acc;
    }, {} as Record<number, Transaction[]>);
    
    allSlabs.forEach(slab => {
      const slabTransactions = transactionsBySlab[slab.id];
      
      if (slabTransactions && slabTransactions.length > 0) {
        let transaction = slabTransactions[0];
        
        slab.transaction = {
          sale_id: transaction.sale_id,
          sale_date: transaction.sale_date,
          customer_name: transaction.customer_name,
          seller_name: transaction.seller_name,
          sale_notes: transaction.sale_notes || '',
          slab_notes: transaction.slab_notes || '',
          square_feet: transaction.square_feet || 0,
          sink: transaction.sink_names || '',
        };
      } else if (slab.sale_id) {
        console.warn(`WARNING: Slab ${slab.id} is marked as sold but has no transaction data!`);
      }
    });
  }
  
  return { slabs, linkedSlabs, stone };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';

  if (intent === "updateSize") {
    const slabId = Number(formData.get("slabId"));
    const length = Number(formData.get("length"));
    const width = Number(formData.get("width"));
    
    if (isNaN(slabId) || isNaN(length) || isNaN(width)) {
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Error", "Invalid values provided", "destructive"));
      return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    
    await db.execute(
      "UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?",
      [length, width, slabId]
    );
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab dimensions updated successfully"));
    return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
  
  return null;
}

export default function SlabsModal() {
  const { slabs, linkedSlabs, stone } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingSlab, setEditingSlab] = useState<number | null>(null);
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
 
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`);
    }
  };

  useEffect(() => {
    if (navigation.state === "idle" && editingSlab !== null) {
      setEditingSlab(null);
    }
  }, [navigation.state]);

  const handleEditClick = (slabId: number) => {
    setEditingSlab(slabId);
  };

  const renderSlabItem = (slab: Slab) => {
    const isEditing = editingSlab === slab.id;
    
    return (
      <TooltipProvider key={slab.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`transition-colors duration-300 flex items-center gap-4 p-2 sm:px-5 rounded-lg border border-gray-200 ${
                slab.sale_id ? "bg-red-300" : "bg-white"
              }`}
            >
              <img
                src={
                  slab.url === "undefined" || slab.url === null
                    ? stone.url
                    : slab.url
                }
                alt="Slab"
                className="w-7 h-7 sm:w-15 sm:h-15 object-cover cursor-pointer rounded"
                onClick={() => {
                  if (slab.url) {
                    setSelectedImage(slab.url);
                  }
                }}
              />
              
              <span
                className={`font-semibold whitespace-nowrap ${
                  slab.sale_id ? "text-red-900" : "text-gray-800"
                }`}
              >
                {slab.bundle}
              </span>

              <div className="flex items-center gap-2 w-full">
                {isEditing ? (
                  <Form method="post" className="flex items-center gap-2 w-full">
                    <AuthenticityTokenInput />
                    <input type="hidden" name="intent" value="updateSize" />
                    <input type="hidden" name="slabId" value={slab.id} />
                    <Input
                      type="number"
                      name="length"
                      defaultValue={slab.length}
                      className="w-12 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      inputMode="numeric"
                    />
                    <span>x</span>
                    <Input
                      type="number"
                      name="width"
                      defaultValue={slab.width}
                      className="w-12 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      inputMode="numeric"
                    />
                    <Button type="submit" size="sm" className="ml-auto">Save</Button>
                  </Form>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handleEditClick(slab.id)}
                    className="text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    {slab.length} x {slab.width}
                  </button>
                )}
              </div>

              {!isEditing && (
                <>
                  <div className="flex gap-2 ml-auto">
                    {slab.transaction ? (
                      <Link to={`edit/${slab.transaction.sale_id}/${location.search}`}>
                        <Button type="button">
                          Edit
                        </Button>
                      </Link>
                    ) : (
                      <>
                    <Link to={`sell/${slab.id}/${location.search}`} className="ml-auto">
                      <Button className="px-4 py-2">
                        Sell
                      </Button>
                    </Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </TooltipTrigger>
          {slab.sale_id && (
            <TooltipContent className="bg-gray-900 text-white p-2 rounded shadow-lg max-w-xs">
              <div className="flex flex-col gap-1 text-sm">
                {slab.transaction ? (
                  <>
                    <p><strong>Sold to:</strong> {slab.transaction.customer_name}</p>
                    <p><strong>Sold by:</strong> {slab.transaction.seller_name}</p>
                    <p><strong>Sale date:</strong> {formatDate(slab.transaction.sale_date)}</p>
                    
                    {(slab.transaction.square_feet ?? 0) > 0 && (
                      <p><strong>Total Square Feet:</strong> {slab.transaction.square_feet}</p>
                    )}
                    
                    {slab.transaction.sink && (
                      <>
                        {formatSinkList(slab.transaction.sink).split(',').map((sink, index) => (
                          <p key={index} className={index > 0 ? "text-sm ml-10" : ""}>
                            {index === 0 ? <><strong>Sink:</strong> {sink}</> : sink}
                          </p>
                        ))}
                      </>
                    )}
                    
                    {slab.transaction.sale_notes && (
                      <p><strong>Notes to Sale:</strong> {slab.transaction.sale_notes}</p>
                    )}
                    
                    {slab.transaction.slab_notes && (
                      <p><strong>Notes to Slab:</strong> {slab.transaction.slab_notes}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p><strong>Status:</strong> Sold</p>
                    <p className="text-red-400">Transaction data not available</p>
                    <p className="text-xs mt-1">This slab is marked as sold but has no transaction details.</p>
                  </>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const allSlabs = [...linkedSlabs, ...slabs];

  return (
    <Dialog
      open={true}
      onOpenChange={handleChange}
    >
      <DialogContent className=" bg-white rounded-md pt-5 px-2 shadow-lg text-gray-800 overflow-y-auto max-h-[95vh]">
        <DialogTitle>Slabs for {stone.name}</DialogTitle>

        <div className="flex flex-col gap-4">
          {allSlabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            allSlabs.map(renderSlabItem)
          )}
        </div>

        <Dialog
          open={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1">
            <DialogClose 
              className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              onClick={(e) => {
                e.preventDefault();
                setSelectedImage(null);
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Slab large view"
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
      <Outlet />
    </Dialog>
  );
}
