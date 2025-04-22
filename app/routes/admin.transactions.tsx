import { ColumnDef } from "@tanstack/react-table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import { getAdminUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";
import { useState } from "react";

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
  is_cut?: number;
}

const ShowMoreText = ({ text, limit = 2 }: { text: string; limit?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text) return <span>N/A</span>;
  
  const items = text.split(', ');
  
  const itemCounts: {[key: string]: number} = {};
  items.forEach(item => {
    if (item) {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    }
  });
  
  const formattedItems = Object.entries(itemCounts).map(([item, count]) => 
    count > 1 ? `${item} x ${count}` : item
  );
  
  if (formattedItems.length <= limit) return <span>{formattedItems.join(', ')}</span>;
  
  const displayText = isExpanded 
    ? formattedItems.join(', ') 
    : formattedItems.slice(0, limit).join(', ');
  
  return (
    <div className="mr-[-10px]">
      <span>{displayText}{!isExpanded && formattedItems.length > limit ? '...' : ''}</span>
      <button
        className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Show less' : `Show ${formattedItems.length - limit} more`}
      </button>
    </div>
  );
};

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
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  
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
     GROUP BY 
       s.id
     ORDER BY 
       s.id`
  );
  
  
  // Simplified main query without sink join
  const transactions = await selectMany<Transaction>(
    db,
    `SELECT 
      s.id,
      s.sale_date,
      c.name as customer_name,
      u.name as seller_name,
      GROUP_CONCAT(DISTINCT CONCAT(si.bundle, ':', COALESCE(si.is_cut, 0)) SEPARATOR ',') as bundle_with_cut,
      GROUP_CONCAT(DISTINCT si.bundle SEPARATOR ', ') as bundle,
      GROUP_CONCAT(DISTINCT st.name SEPARATOR ', ') as stone_name,
      ROUND(SUM(si.square_feet), 2) as sf,
      s.status as is_deleted,
      '' as sink_type,
      COALESCE(MAX(si.is_cut), 0) as is_cut
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
    GROUP BY
      s.id, s.sale_date, c.name, u.name
    ORDER BY 
      s.sale_date DESC`
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
};

const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "sale_date",
    header: ({ column }) => <SortableHeader column={column} title="Date" />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: "datetime",
  },
  {
    accessorKey: "customer_name",
    header: ({ column }) => <SortableHeader column={column} title="Customer" />,
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
      const bundlesWithCut = (row.original.bundle_with_cut || '').split(',').filter(Boolean);
      if (!bundlesWithCut.length) return <span>N/A</span>;
      
      const cutMap = Object.fromEntries(
        bundlesWithCut.map(item => {
          const [bundle, isCut] = item.split(':');
          return [bundle.trim(), Number(isCut) === 1];
        })
      );
      
      const bundles = (row.original.bundle || '').split(', ').filter(Boolean);
      
      return (
        <div className="flex flex-col">
          {bundles.map((bundle, index) => (
            <span 
              key={index} 
              className={cutMap[bundle] ? "text-blue-500" : "text-green-500"}
            >
              {bundle}
            </span>
          ))}
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
      
      return <span className={`${colorClass} font-medium`}>{formattedStatus || "Active"}</span>;
    },
  },
];

export default function AdminTransactions() {
  const { transactions } = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Sales Transactions">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Transactions</h1>
        {/* <Link to="/admin/reports">
          <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
            Reports
          </Button>
        </Link> */}
      </div>
      <DataTable 
        columns={transactionColumns} 
        data={transactions} 
      />
    </PageLayout>
  );
} 