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
  parent_id: number | null;
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
  parent_transaction?: {
    customer_name: string;
    seller_name: string;
  };
}

const TransactionSchema = z.object({
  slab_id: z.number(),
  sale_id: z.number(),
  sale_date: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === "string" ? val : val.toISOString())),
  customer_name: z.string(),
  seller_name: z
    .string()
    .nullable()
    .transform((val) => (val ?? "Unknown Seller")),
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
  if (!sinkString) return "";

  const sinks = sinkString.split(", ");
  const sinkCounts: { [key: string]: number } = {};

  sinks.forEach((sink) => {
    if (sink) {
      sinkCounts[sink] = (sinkCounts[sink] || 0) + 1;
    }
  });

  return Object.entries(sinkCounts)
    .map(([sink, count]) => (count > 1 ? `${sink} x ${count}` : sink))
    .join(", ");
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

  const url = new URL(request.url);
  const saleId = url.searchParams.get("saleId");

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
    "SELECT id, bundle, url, sale_id, width, length, cut_date, parent_id FROM slab_inventory WHERE stone_id = ? AND cut_date IS NULL",
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
           id, bundle, url, sale_id, width, length, cut_date, parent_id
         FROM slab_inventory 
         WHERE stone_id = ? AND cut_date IS NULL`,
        [link.source_stone_id]
      );

      linkedStoneSlabs.forEach((slab) => {
        slab.source_stone_id = link.source_stone_id;
        slab.source_stone_name = link.source_stone_name;
      });

      linkedSlabs = [...linkedSlabs, ...linkedStoneSlabs];
    }
  } catch (err) {
    console.error("Error fetching linked slabs:", err);
  }

  const allSlabs = [...slabs, ...linkedSlabs];
  const soldSlabIds = allSlabs
    .filter((slab) => slab.sale_id)
    .map((slab) => slab.id);

  if (soldSlabIds.length > 0) {
    const placeholders = soldSlabIds.map(() => "?").join(",");

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
          JOIN slab_inventory si ON sinks.slab_id = si.id
          WHERE si.sale_id = sales.id
        ) as sink_names
      FROM 
        sales
      LEFT JOIN 
        customers ON sales.customer_id = customers.id
      LEFT JOIN 
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
    const transactionResults = rawTransactions
      .map((raw) => {
        try {
          const parsed = TransactionSchema.parse(raw);
          return parsed;
        } catch (error) {
          console.error(
            `Validation error for transaction with sale_id ${raw.sale_id}:`,
            error
          );
          console.error("Raw transaction data:", raw);
          return null;
        }
      })
      .filter(Boolean) as Transaction[];

    const transactionsBySlab = transactionResults.reduce((acc, transaction) => {
      if (!acc[transaction.slab_id]) {
        acc[transaction.slab_id] = [];
      }
      acc[transaction.slab_id].push(transaction);
      return acc;
    }, {} as Record<number, Transaction[]>);

    allSlabs.forEach((slab) => {
      const slabTransactions = transactionsBySlab[slab.id];

      if (slabTransactions && slabTransactions.length > 0) {
        let transaction = slabTransactions[0];

        slab.transaction = {
          sale_id: transaction.sale_id,
          sale_date: transaction.sale_date,
          customer_name: transaction.customer_name,
          seller_name: transaction.seller_name,
          sale_notes: transaction.sale_notes || "",
          slab_notes: transaction.slab_notes || "",
          square_feet: transaction.square_feet || 0,
          sink: transaction.sink_names || "",
        };
      } else if (slab.sale_id) {
        console.warn(
          `WARNING: Slab ${slab.id} is marked as sold but has no transaction data!`
        );
      }
    });
  }

  // Get parent transactions for slabs with parent_id
  const slabsWithParent = allSlabs
    .filter((slab) => slab.parent_id)
    .map((slab) => slab.parent_id);

  if (slabsWithParent.length > 0) {
    const parentPlaceholders = slabsWithParent.map(() => "?").join(",");

    const parentSqlQuery = `
      SELECT 
        slab_inventory.id as slab_id,
        COALESCE(customers.name, 'Unknown Customer') as customer_name,
        COALESCE(users.name, 'Unknown Seller') as seller_name
      FROM 
        sales
      LEFT JOIN 
        customers ON sales.customer_id = customers.id
      LEFT JOIN 
        users ON sales.seller_id = users.id
      JOIN 
        slab_inventory ON sales.id = slab_inventory.sale_id
      WHERE 
        slab_inventory.id IN (${parentPlaceholders})
    `;

    const parentTransactions = await selectMany<{
      slab_id: number;
      customer_name: string;
      seller_name: string;
    }>(db, parentSqlQuery, slabsWithParent);

    const parentTransactionsBySlabId = parentTransactions.reduce(
      (acc, transaction) => {
        acc[transaction.slab_id] = transaction;
        return acc;
      },
      {} as Record<number, { customer_name: string; seller_name: string }>
    );

    allSlabs.forEach((slab) => {
      if (slab.parent_id && parentTransactionsBySlabId[slab.parent_id]) {
        slab.parent_transaction = {
          customer_name:
            parentTransactionsBySlabId[slab.parent_id].customer_name,
          seller_name: parentTransactionsBySlabId[slab.parent_id].seller_name,
        };
      }
    });
  }

  return { slabs, linkedSlabs, stone, saleId };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  if (intent === "updateSize") {
    const slabId = Number(formData.get("slabId"));
    const length = Number(formData.get("length"));
    const width = Number(formData.get("width"));

    if (isNaN(slabId) || isNaN(length) || isNaN(width)) {
      const session = await getSession(request.headers.get("Cookie"));
      session.flash(
        "message",
        toastData("Error", "Invalid values provided", "destructive")
      );
      return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }

    await db.execute(
      "UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?",
      [length, width, slabId]
    );

    const session = await getSession(request.headers.get("Cookie"));
    session.flash(
      "message",
      toastData("Success", "Slab dimensions updated successfully")
    );
    return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  return null;
}

export default function SlabsModal() {
  const { slabs, linkedSlabs, stone, saleId } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingSlab, setEditingSlab] = useState<number | null>(null);
  const [highlightedSlab, setHighlightedSlab] = useState<number | null>(null);
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (saleId && saleId !== "null" && saleId !== "") {
      window.open(`/api/pdf/${saleId}`, "_blank");
      const searchParams = new URLSearchParams(location.search);
      searchParams.delete("saleId");
      const newSearch = searchParams.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ""}`, {
        replace: true,
      });
    }
  }, [saleId, navigate, location]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const slabId = searchParams.get("slab");

    if (slabId) {
      const id = parseInt(slabId);
      setHighlightedSlab(id);

      const timer = setTimeout(() => {
        setHighlightedSlab(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [location.search]);

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
    const isHighlighted = highlightedSlab === slab.id;
    const hasParent = slab.parent_id !== null;
    const hasChildren = allSlabs.some(
      (otherSlab) => otherSlab.parent_id === slab.id
    );

    return (
      <TooltipProvider key={slab.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`transition-all duration-300 flex items-center gap-4 p-2 sm:px-5 rounded-lg ${
                slab.sale_id
                  ? "bg-red-300 "
                  : hasParent
                  ? "bg-yellow-200 "
                  : "bg-white "
              }${
                isHighlighted
                  ? "border-2 border-blue-500"
                  : slab.sale_id
                  ? "border border-red-400"
                  : hasParent
                  ? "border border-yellow-400"
                  : "border border-gray-200"
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
                  slab.sale_id
                    ? "text-red-900"
                    : hasParent
                    ? "text-yellow-800"
                    : "text-gray-800"
                }`}
              >
                {slab.bundle}
              </span>

              <div className="flex items-center gap-2 w-full">
                {isEditing ? (
                  <Form
                    method="post"
                    className="flex items-center gap-2 w-full"
                  >
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
                    <Button type="submit" size="sm" className="ml-auto">
                      Save
                    </Button>
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
                    {slab.sale_id ? (
                      <Link to={`edit/${slab.sale_id}/${location.search}`}>
                        <Button type="button">Edit</Button>
                      </Link>
                    ) : (
                      <>
                        <Link
                          to={`sell/${slab.id}/${location.search}`}
                          className="ml-auto"
                        >
                          <Button className="px-4 py-2">Sell</Button>
                        </Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </TooltipTrigger>
          {(slab.sale_id || slab.parent_transaction) && (
            <TooltipContent className="bg-gray-900 text-white p-2 rounded shadow-lg max-w-xs">
              <div className="flex flex-col gap-1 text-sm">
                {slab.transaction ? (
                  <>
                    {slab.parent_id && slab.parent_transaction && (
                      <>
                        <p>
                          <strong>Partially Sold by:</strong>{" "}
                          {slab.parent_transaction.seller_name}
                        </p>
                        <div className="mb-1 border-b border-gray-700"></div>
                      </>
                    )}

                    <p>
                      <strong>Sold to:</strong> {slab.transaction.customer_name}
                    </p>
                    <p>
                      <strong>Sold by:</strong> {slab.transaction.seller_name}
                    </p>
                    <p>
                      <strong>Sale date:</strong>{" "}
                      {formatDate(slab.transaction.sale_date)}
                    </p>

                    {(slab.transaction.square_feet ?? 0) > 0 && (
                      <p>
                        <strong>Total Square Feet:</strong>{" "}
                        {slab.transaction.square_feet}
                      </p>
                    )}

                    {slab.transaction.sink && (
                      <>
                        {formatSinkList(slab.transaction.sink)
                          .split(",")
                          .map((sink, index) => (
                            <p
                              key={index}
                              className={index > 0 ? "text-sm ml-10" : ""}
                            >
                              {index === 0 ? (
                                <>
                                  <strong>Sink:</strong> {sink}
                                </>
                              ) : (
                                sink
                              )}
                            </p>
                          ))}
                      </>
                    )}

                    {slab.transaction.sale_notes && (
                      <p>
                        <strong>Notes to Sale:</strong>{" "}
                        {slab.transaction.sale_notes}
                      </p>
                    )}

                    {slab.transaction.slab_notes && (
                      <p>
                        <strong>Notes to Slab:</strong>{" "}
                        {slab.transaction.slab_notes}
                      </p>
                    )}
                  </>
                ) : slab.parent_transaction ? (
                  <>
                    <p>
                      <strong>Partially sold to:</strong>{" "}
                      {slab.parent_transaction.customer_name}
                    </p>
                    <p>
                      <strong>Partially sold by:</strong>{" "}
                      {slab.parent_transaction.seller_name}
                    </p>
                  </>
                ) : slab.sale_id ? (
                  <>
                    <p>
                      <strong>Status:</strong> Sold
                    </p>
                    <p className="text-red-400">
                      Transaction data not available
                    </p>
                    <p className="text-xs mt-1">
                      This slab is marked as sold but has no transaction
                      details.
                    </p>
                    <p className="text-xs mt-1">Sale ID: {slab.sale_id}</p>
                  </>
                ) : null}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const allSlabs = [...linkedSlabs, ...slabs];

  // Create a map of bundle names to slabs
  const slabsByBundle: Record<string, Slab[]> = {};

  // Group slabs by bundle
  allSlabs.forEach((slab) => {
    if (!slabsByBundle[slab.bundle]) {
      slabsByBundle[slab.bundle] = [];
    }
    slabsByBundle[slab.bundle].push(slab);
  });

  // Order the bundle names naturally (Slab 1, Slab 2, etc.)
  const orderedBundles = Object.keys(slabsByBundle).sort((a, b) => {
    // Extract numbers from bundle names if they exist
    const aMatch = a.match(/(\d+)/);
    const bMatch = b.match(/(\d+)/);

    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[0], 10);
      const bNum = parseInt(bMatch[0], 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    }

    // Fallback to string comparison
    return a.localeCompare(b);
  });

  // Create final ordered list
  const sortedSlabs: Slab[] = [];

  // For each bundle, add all slabs with that bundle name
  orderedBundles.forEach((bundle) => {
    const bundleSlabs = slabsByBundle[bundle];

    // Get all parent slabs (no parent_id)
    const parents = bundleSlabs.filter((slab) => slab.parent_id === null);

    // For each parent, add the parent first, then its children immediately after
    parents.forEach((parent) => {
      // Add the parent
      sortedSlabs.push(parent);

      // Find and add all children of this parent
      const children = bundleSlabs.filter(
        (slab) => slab.parent_id === parent.id
      );
      sortedSlabs.push(...children);
    });
  });

  const uniqueSlabs = sortedSlabs;

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="bg-white rounded-md pt-5 px-2 shadow-lg text-gray-800 overflow-y-auto max-h-[95vh]">
        <DialogTitle>Slabs for {stone.name}</DialogTitle>

        <div className="flex flex-col gap-4">
          {uniqueSlabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            uniqueSlabs.map(renderSlabItem)
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
