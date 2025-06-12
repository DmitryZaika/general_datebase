import { LoaderFunctionArgs, useLoaderData } from "react-router";
import { z } from "zod";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { DataTable } from "~/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";
import { useFetcher } from "react-router";

const paramsSchema = z.object({
    viewId: z.string().uuid("View ID must be a valid UUID")
});

interface Sale {
    id: number;
    sale_date: string;
    price: number;
    seller_name: string;
    customer_name: string;
    paid_date: string | null;
}

export async function loader({ params }: LoaderFunctionArgs) {
    const { viewId } = paramsSchema.parse(params);

    const sales = await selectMany<Sale>(
        db,
        `SELECT 
            s.id,
            s.sale_date,
            s.price,
            s.paid_date,
            u.name as seller_name,
            c.name as customer_name
        FROM sales s
        JOIN users u ON s.seller_id = u.id
        JOIN customers c ON s.customer_id = c.id
        WHERE c.view_id = UUID_TO_BIN(?)
        ORDER BY s.sale_date DESC`,
        [viewId]
    );

    return { customer: { name: sales[0].customer_name }, sales };
}

const columns: ColumnDef<Sale>[] = [
    {
        accessorKey: "sale_date",
        header: ({ column }) => <SortableHeader column={column} title="Date" />,
        cell: ({ row }) => {
            const date = new Date(row.original.sale_date);
            return new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).format(date);
        },
        sortingFn: "datetime",
    },
    {
        accessorKey: "price",
        header: ({ column }) => <SortableHeader column={column} title="Amount" />,
        cell: ({ row }) => {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD"
            }).format(row.original.price);
        },
    },
    {
        accessorKey: "seller_name",
        header: ({ column }) => <SortableHeader column={column} title="Sold By" />,
    },
    {
        id: "payment",
        header: "Payment",
        cell: ({ row }) => {
            const fetcher = useFetcher();
            const isPaid = row.original.paid_date !== null;
            const isSubmitting = fetcher.state === "submitting";

            if (isPaid) {
                return (
                    <span className="text-green-600 font-medium">
                        Paid on {new Date(row.original.paid_date!).toLocaleDateString()}
                    </span>
                );
            }

            return (
                <fetcher.Form method="post" action="/api/stripe/create-checkout">
                    <input type="hidden" name="saleId" value={row.original.id} />
                    <input type="hidden" name="amount" value={row.original.price} />
                    <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isSubmitting ? "Processing..." : "Pay Now"}
                    </Button>
                </fetcher.Form>
            );
        },
    },
];

export default function CustomersView() {
    const { customer, sales } = useLoaderData<typeof loader>();
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">{customer?.name}</h1>
            <DataTable columns={columns} data={sales} />
        </div>
    );
}