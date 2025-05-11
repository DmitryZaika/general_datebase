import { ColumnDef } from "@tanstack/react-table";
import { Link, LoaderFunctionArgs, Outlet, redirect, useSearchParams, useNavigate, Form, ActionFunctionArgs } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { Search, MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toastData } from "~/utils/toastHelpers";
import { getSession, commitSession } from "~/sessions";

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
  all_cut?: number;
}

interface SlabInfo {
  id: number;
  cut_date: string | null;
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
    const url = new URL(request.url);
    
    const searchTerm = url.searchParams.get('search') || '';
    const salesRep = url.searchParams.get('salesRep') || user.name;
    const status = url.searchParams.get('status') || 'in_progress';
    
    let query = `
      SELECT 
        s.id,
        s.sale_date,
        c.name as customer_name,
        u.name as seller_name,
        GROUP_CONCAT(DISTINCT si.bundle) as bundle,
        s.status as is_deleted,
        '' as sink_type,
        GROUP_CONCAT(DISTINCT st.name) as stone_name,
        ROUND(SUM(si.square_feet), 2) as sf,
        GROUP_CONCAT(DISTINCT CONCAT(si.bundle, ':', IF(si.cut_date IS NOT NULL, 'CUT', 'UNCUT'))) as bundle_with_cut,
        MIN(CASE WHEN si.cut_date IS NULL THEN 0 ELSE 1 END) as all_cut
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
    `;
    
    const queryParams: any[] = [companyId];
    
    if (salesRep && salesRep !== "All") {
      query += " AND u.name = ?";
      queryParams.push(salesRep);
    }
    
    if (status === "in_progress") {
      query += " AND s.status IN ('Cut', 'Sold')";
    } else if (status === "finished") {
      query += " AND s.status IN ('Installed', 'Cancelled')";
    }
    
    if (searchTerm) {
      query += ` AND (
        c.name LIKE ? OR
        u.name LIKE ? OR
        si.bundle LIKE ? OR
        st.name LIKE ?
      )`;
      const searchPattern = `%${searchTerm}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    query += `
      GROUP BY
        s.id, s.sale_date, c.name, u.name
      ORDER BY 
        s.sale_date DESC
    `;
    
    const transactions = await selectMany<Transaction>(db, query, queryParams);
    
    interface SinkInfo {
      sale_id: number;
      sink_types: string;
    }
    
    const sinkDetails = await selectMany<SinkInfo>(
      db,
      `SELECT 
         sales.id as sale_id, 
         GROUP_CONCAT(st.name SEPARATOR ', ') as sink_types
       FROM 
         sales 
       JOIN 
         sinks sk ON sales.id = sk.sale_id
       JOIN 
         sink_type st ON sk.sink_type_id = st.id
       WHERE
         sales.company_id = ?
       GROUP BY 
         sales.id
       ORDER BY 
         sales.id`,
      [companyId]
    );
    
    const allSalesReps = await selectMany<{name: string}>(
      db,
      `SELECT DISTINCT users.name 
       FROM users 
       JOIN sales ON users.id = sales.seller_id 
       WHERE sales.company_id = ?`,
      [companyId]
    );
    
    const salesReps = ["All", ...allSalesReps.map(rep => rep.name)];
    
    const updatedTransactions = transactions.map(t => {
      const sinkInfo = sinkDetails.find(sd => sd.sale_id === t.id);
      if (sinkInfo) {
        return {...t, sink_type: sinkInfo.sink_types};
      }
      return t;
    });
    
    return {
      transactions: updatedTransactions,
      currentUser: user.name,
      salesReps,
      filters: {
        search: searchTerm,
        salesRep,
        status
      }
    };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  if (!user || !user.company_id) {
    return { error: "Unauthorized" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const transactionId = formData.get("transactionId");

  if (intent === "mark-installed") {
    try {
      const transaction = await selectMany<{ status: string }>(
        db,
        `SELECT status FROM sales WHERE id = ?`,
        [transactionId]
      );
      
      if (transaction.length === 0) {
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Error", "Transaction not found", "destructive"));
        return { 
          error: "Transaction not found",
          headers: { "Set-Cookie": await commitSession(session) }
        };
      }
      
      const status = transaction[0].status.toLowerCase();
      if (status !== "cut") {
        const session = await getSession(request.headers.get("Cookie"));
        session.flash("message", toastData("Error", "Only transactions with 'Cut' status can be marked as installed", "destructive"));
        return { 
          error: "Only transactions with 'Cut' status can be marked as installed",
          headers: { "Set-Cookie": await commitSession(session) }
        };
      }
      
      await db.execute(
        `UPDATE sales SET status = 'installed' WHERE id = ?`,
        [transactionId]
      );
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "Transaction marked as installed"));
      
      return { 
        success: true,
        headers: { "Set-Cookie": await commitSession(session) }
      };
    } catch (error) {
      console.error("Error updating status:", error);
      
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Error", "Failed to update status", "destructive"));
      
      return { 
        error: "Failed to update status",
        headers: { "Set-Cookie": await commitSession(session) }
      };
    }
  }
  
  return { error: "Invalid action" };
}

export default function EmployeeTransactions() {
  const { transactions, currentUser, salesReps, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();  
  const [searchValue, setSearchValue] = useState(filters.search);
  const navigate = useNavigate();
  
  const handleSalesRepChange = (value: string) => {
    searchParams.set('salesRep', value);
    setSearchParams(searchParams);
  };
  
  const handleStatusChange = (value: string) => {
    searchParams.set('status', value);
    setSearchParams(searchParams);
  };
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchParams.set('search', searchValue);
    setSearchParams(searchParams);
  };

  const handleRowClick = (id: number) => {
    navigate(`edit/${id}`);
  };
  
  const handleInstall = async (id: number) => {
    try {
      const formData = new FormData();
      formData.append("intent", "mark-installed");
      formData.append("transactionId", id.toString());
      
      await fetch("/employee/transactions", {
        method: "POST",
        body: formData
      });
      
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
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
      cell: ({ row }) => row.original.customer_name,
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
        } else if (formattedStatus === "Cancelled") {
          colorClass = "text-red-500";
        } else if (formattedStatus === "Cut") {
          colorClass = "text-blue-500";
        } else if (formattedStatus === "Installed") {
          colorClass = "text-purple-500";
        }
        
        return <span className={colorClass}>{formattedStatus}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const status = (row.original.is_deleted || "").toLowerCase();
        const canInstall = status === "cut";
        
        return (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleInstall(row.original.id)}
                  disabled={!canInstall}
                  className={!canInstall ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Mark as Installed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
  
  return (
    <PageLayout title="Transactions">
      <div className="container mx-auto py-10">
        <div className="mb-4 flex flex-col gap-4">
          <Form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search transactions..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8"
            />
          </Form>
          
          <div className="flex gap-4">
            <div className="w-1/8 min-w-[120px]">
              <div className="mb-1 text-sm font-medium">Sales Rep</div>
              <Select 
                value={filters.salesRep} 
                onValueChange={handleSalesRepChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sales Rep" />
                </SelectTrigger>
                <SelectContent>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep} value={rep}>
                      {rep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-1/8 min-w-[120px]">
              <div className="mb-1 text-sm font-medium">Status</div>
              <Select 
                value={filters.status} 
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DataTable
          columns={transactionColumns}
          data={transactions.map(transaction => ({
            ...transaction,
            className: "hover:bg-gray-50 cursor-pointer",
            onClick: () => handleRowClick(transaction.id)
          }))}
        />

        <Outlet />
      </div>
    </PageLayout>
  );
} 