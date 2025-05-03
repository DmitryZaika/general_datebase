import { ColumnDef } from "@tanstack/react-table";
import { Link, LoaderFunctionArgs, Outlet, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import React from "react";

interface Transaction {
  id: number;
  sale_date: string;
  customer_name: string;
  seller_name: string;
  bundle: string;
  bundle_with_cut: string;
  stone_name: string;
  sf?: number;
  is_deleted: string;
  sink_type?: string;
  cut_date?: string | null;
}

function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    if (!user || !user.company_id) {
      return redirect('/login');
    }
    
    const companyId = user.company_id;
    
    interface SinkInfo {
      sale_id: number;
      sink_types: string;
    }
    
    const sinkDetails = await selectMany<SinkInfo>(
      db,
      `SELECT 
         s.id as sale_id, 
         GROUP_CONCAT(st.name SEPARATOR ', ') as sink_types
       FROM 
         sales s
       JOIN 
         sinks sk ON s.id = sk.sale_id
       JOIN 
         sink_type st ON sk.sink_type_id = st.id
       WHERE
         s.company_id = ?
       GROUP BY 
         s.id
       ORDER BY 
         s.id`,
      [companyId]
    );
    
    
    const transactions = await selectMany<Transaction>(
      db,
      `SELECT 
        s.id,
        s.sale_date,
        c.name as customer_name,
        u.name as seller_name,
        GROUP_CONCAT(DISTINCT si.bundle) as bundle,
        s.status as is_deleted,
        '' as sink_type,
        GROUP_CONCAT(DISTINCT st.name) as stone_name,
        ROUND(SUM(si.square_feet), 2) as sf,
        GROUP_CONCAT(DISTINCT CONCAT(si.bundle, ':', IF(si.cut_date IS NOT NULL, 'CUT', 'UNCUT'))) as bundle_with_cut
      FROM 
        sales s
      JOIN 
        customers c ON s.customer_id = c.id
      JOIN 
        users u ON s.seller_id = u.id
      LEFT JOIN
        slab_inventory si ON s.id = si.sale_id
      LEFT JOIN
        stones st ON si.stone_id = st.id
      WHERE
        s.company_id = ?
      GROUP BY
        s.id, s.sale_date, c.name, u.name
      ORDER BY 
        s.sale_date DESC`,
      [companyId]
    );
    
    const updatedTransactions = transactions.map(t => {
      const sinkInfo = sinkDetails.find(sd => sd.sale_id === t.id);
      if (sinkInfo) {
        return {...t, sink_type: sinkInfo.sink_types};
      }
      return t;
    });
    
    return {
      transactions: updatedTransactions,
    };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "sale_date",
    header: ({ column }) => <SortableHeader column={column} title="Sale Date" />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: "datetime",
  },
  {
    accessorKey: "customer_name",
    header: ({ column }) => <SortableHeader column={column} title="Customer" />,
    cell: ({ row }) => (
      <Link 
        to={`edit/${row.original.id}`} 
        className="text-blue-600 hover:underline"
      >
        {row.original.customer_name}
      </Link>
    ),
  },
  {
    accessorKey: "seller_name",
    header: ({ column }) => <SortableHeader column={column} title="Sold By" />,
  },
  {
    accessorKey: "stone_name",
    header: ({ column }) => <SortableHeader column={column} title="Stone" />,
    cell: ({ row }) => {
      const stones = (row.original.stone_name || '').split(', ').filter(Boolean);
      if (!stones.length) return <span>N/A</span>;
      
      const stoneCounts: {[key: string]: number} = {};
      stones.forEach(stone => {
        stoneCounts[stone] = (stoneCounts[stone] || 0) + 1;
      });
      
      const formattedStones = Object.entries(stoneCounts).map(([stone, count]) => 
        count > 1 ? `${stone} x ${count}` : stone
      );
      
      return (
        <div className="flex flex-col">
          {formattedStones.map((stone, index) => (
            <span key={index}>{stone}</span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "sink_type",
    header: ({ column }) => <SortableHeader column={column} title="Sink" />,
    cell: ({ row }) => {
      const sinks = (row.original.sink_type || '').split(', ').filter(Boolean);
      if (!sinks.length) return <span>N/A</span>;
      
      const sinkCounts: {[key: string]: number} = {};
      sinks.forEach(sink => {
        sinkCounts[sink] = (sinkCounts[sink] || 0) + 1;
      });
      
      const formattedSinks = Object.entries(sinkCounts).map(([sink, count]) => 
        count > 1 ? `${sink} x ${count}` : sink
      );
      
      return (
        <div className="flex flex-col">
          {formattedSinks.map((sink, index) => (
            <span key={index}>{sink}</span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "bundle",
    header: ({ column }) => <SortableHeader column={column} title="Bundle" />,
    cell: ({ row }) => {
      const bundleInfo = (row.original.bundle_with_cut || '').split(',').filter(Boolean);
      if (!bundleInfo.length) return <span>N/A</span>;
      
      const bundleStatusMap: {[key: string]: boolean} = {};
      bundleInfo.forEach(item => {
        const [bundle, status] = item.split(':');
        bundleStatusMap[bundle] = status === 'CUT';
      });
      
      const bundles = (row.original.bundle || '').split(',').filter(Boolean);
      
      return (
        <div className="flex flex-col">
          {bundles.map((bundle, index) => {
            const isCut = bundleStatusMap[bundle] === true;
            return (
              <span 
                key={index} 
                className={isCut ? "text-blue-500" : "text-green-500"}
              >
                {bundle}
              </span>
            );
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "sf",
    header: ({ column }) => <SortableHeader column={column} title="SF" />,
    cell: ({ row }) => row.original.sf ? `${row.original.sf}` : "N/A",
  },
 
  {
    accessorKey: "is_deleted",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.original.is_deleted || "";
      const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      
      let colorClass = "text-gray-500";
      if (formattedStatus === "Sold") {
        colorClass = "text-green-500";
      } else if (formattedStatus === "Canceled" || formattedStatus === "Cancelled") {
        colorClass = "text-red-500";
      } else if (formattedStatus === "Cut") {
        colorClass = "text-blue-500";
      }
      
      return <span className={colorClass}>{formattedStatus}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-end gap-2">
          <Link to={`edit/${row.original.id}`}>
            <Button variant="outline" size="sm">
              View
            </Button>
          </Link>
        </div>
      );
    },
  },
];

export default function EmployeeTransactions() {
  const { transactions } = useLoaderData<typeof loader>();
  const [globalFilter, setGlobalFilter] = useState("");

  // Filter transactions based on global filter
  const filteredData = React.useMemo(() => {
    if (!globalFilter) return transactions;
    
    const searchTerm = globalFilter.toLowerCase();
    return transactions.filter(transaction => {
      return (
        transaction.customer_name.toLowerCase().includes(searchTerm) ||
        transaction.seller_name.toLowerCase().includes(searchTerm) ||
        transaction.stone_name?.toLowerCase().includes(searchTerm) ||
        transaction.bundle?.toLowerCase().includes(searchTerm) ||
        transaction.sink_type?.toLowerCase().includes(searchTerm) ||
        formatDate(transaction.sale_date).toLowerCase().includes(searchTerm)
      );
    });
  }, [transactions, globalFilter]);

  return (
    <PageLayout title="Transactions">
      <div className="container mx-auto py-10">
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search transactions..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <DataTable
          columns={transactionColumns}
          data={filteredData}
        />

        <Outlet />
      </div>
    </PageLayout>
  );
} 