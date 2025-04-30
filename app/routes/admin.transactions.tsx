import { ColumnDef } from "@tanstack/react-table";
import { Link, LoaderFunctionArgs, Outlet, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import { getAdminUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";

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
      
      return <span className={`${colorClass} font-medium`}>{formattedStatus || "Active"}</span>;
    },
  },
];

export default function AdminTransactions() {
  const { transactions } = useLoaderData<typeof loader>();

  const getPDF = async () => {
    try {
      const response = await fetch("/api/pdf", { 
        method: "POST",
        headers: {
          "Accept": "application/pdf"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/["']/g, '')
        : 'transaction-report.pdf';
      
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Error downloading PDF. Please try again.");
    }
  };
  
  return (
    <>
      <PageLayout title="Sales Transactions">
        <div className="mb-4 flex justify-between items-center">
          {/* <button onClick={() => getPDF()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Download PDF
          </button> */}
          <h1 className="text-2xl font-bold">Transactions</h1>
          <Link to="/admin/reports">
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
              Reports
            </Button>
          </Link>
        </div>
        <DataTable 
          columns={transactionColumns} 
          data={transactions} 
        />
      </PageLayout>
    
    </>
  );
} 