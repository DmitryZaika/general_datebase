import { ColumnDef } from "@tanstack/react-table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { Form, useLoaderData, useSearchParams } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { getAdminUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useEffect, useState } from "react";
import { FormProvider, FormField } from "~/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputItem } from "~/components/molecules/InputItem";
import { SelectInput } from "~/components/molecules/SelectItem";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

// Interface for slab data with additional details
interface SlabReport {
  id: number;
  bundle: string;
  stone_name: string;
  supplier_name: string;
  width: number;
  length: number;
  is_cut: number;
  cut_date: string;
  sale_date: string;
  customer_name: string;
  seller_name: string;
  square_feet: number;
  notes: string;
  status: string;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
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

  const url = new URL(request.url);
  const reportType = url.searchParams.get("type") || "cut_slabs";
  const fromDate = url.searchParams.get("fromDate") || "";
  const toDate = url.searchParams.get("toDate") || "";
  const supplierId = url.searchParams.get("supplier") || "";
  const stoneId = url.searchParams.get("stone") || "";

  // Приведение "all" к пустой строке для фильтрации
  const supplierFilter = supplierId === "all" ? "" : supplierId;
  const stoneFilter = stoneId === "all" ? "" : stoneId;

  // Get suppliers for filter dropdown
  const suppliers = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, supplier_name as name FROM suppliers ORDER BY supplier_name ASC`
  );

  // Get stones for filter dropdown
  const stones = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, name FROM stones ORDER BY name ASC`
  );

  let slabs: SlabReport[] = [];
  let query = "";
  const queryParams: any[] = [];

  // Switch between different report types
  switch (reportType) {
    case "cut_slabs":
      query = `
        SELECT 
          slab_inventory.id,
          bundle,
          stones.name as stone_name,
          suppliers.supplier_name as supplier_name,
          slab_inventory.width,
          slab_inventory.length,
          slab_inventory.is_sold,
          slab_inventory.created_at as cut_date,
          sales.sale_date,
          customers.name as customer_name,
          users.name as seller_name,
          slab_inventory.square_feet,
          slab_inventory.notes,
          CASE 
            WHEN slab_inventory.is_sold = 1 AND sales.id IS NOT NULL THEN 'Cut & Sold'
            WHEN slab_inventory.sale_id IS NOT NULL THEN 'Sold'
            ELSE 'In Stock'
          END as status
        FROM 
          slab_inventory
        JOIN 
          stones ON slab_inventory.stone_id = stones.id
        JOIN 
          suppliers ON stones.supplier_id = suppliers.id
        LEFT JOIN 
          sales ON slab_inventory.sale_id = sales.id
        LEFT JOIN 
          customers ON sales.customer_id = customers.id
        LEFT JOIN 
          users ON sales.seller_id = users.id
        WHERE 
          slab_inventory.is_cut = 1
          AND (slab_inventory.parent_id IS NULL OR slab_inventory.parent_id = 0)
      `;

      if (fromDate) {
        query += ` AND DATE(slab_inventory.created_at) >= ?`;
        queryParams.push(fromDate);
      }
      if (toDate) {
        query += ` AND DATE(slab_inventory.created_at) <= ?`;
        queryParams.push(toDate);
      }
      
      if (supplierFilter) {
        query += ` AND suppliers.id = ?`;
        queryParams.push(supplierFilter);
      }
      
      if (stoneFilter) {
        query += ` AND stones.id = ?`;
        queryParams.push(stoneFilter);
      }

      query += ` ORDER BY slab_inventory.created_at DESC`;
      break;

    case "sold_slabs":
      query = `
        SELECT 
          slab_inventory.id,
          bundle,
          stones.name as stone_name,
          suppliers.supplier_name as supplier_name,
          slab_inventory.width,
          slab_inventory.length,
          slab_inventory.is_sold,
          slab_inventory.created_at as cut_date,
          sales.sale_date,
          customers.name as customer_name,
          users.name as seller_name,
          slab_inventory.square_feet,
          slab_inventory.notes,
          CASE 
            WHEN slab_inventory.is_sold = 1 AND sales.id IS NOT NULL THEN 'Cut & Sold'
            WHEN slab_inventory.sale_id IS NOT NULL THEN 'Sold'
            ELSE 'In Stock'
          END as status
        FROM 
          slab_inventory
        JOIN 
          stones ON slab_inventory.stone_id = stones.id
        JOIN 
          suppliers ON stones.supplier_id = suppliers.id
        JOIN 
          sales ON slab_inventory.sale_id = sales.id
        JOIN 
          customers ON sales.customer_id = customers.id
        JOIN 
          users ON sales.seller_id = users.id
        WHERE 
          slab_inventory.sale_id IS NOT NULL
      `;

      if (fromDate) {
        query += ` AND DATE(sales.sale_date) >= ?`;
        queryParams.push(fromDate);
      }
      if (toDate) {
        query += ` AND DATE(sales.sale_date) <= ?`;
        queryParams.push(toDate);
      }
      
      if (supplierFilter) {
        query += ` AND suppliers.id = ?`;
        queryParams.push(supplierFilter);
      }
      
      if (stoneFilter) {
        query += ` AND stones.id = ?`;
        queryParams.push(stoneFilter);
      }

      query += ` ORDER BY sales.sale_date DESC`;
      break;

    case "inventory":
      query = `
        SELECT 
          slab_inventory.id,
          bundle,
          stones.name as stone_name,
          suppliers.supplier_name as supplier_name,
          slab_inventory.width,
          slab_inventory.length,
          slab_inventory.is_sold,
          NULL as cut_date,
          NULL as sale_date,
          NULL as customer_name,
          NULL as seller_name,
          slab_inventory.square_feet,
          slab_inventory.notes,
          'In Stock' as status
        FROM 
          slab_inventory
        JOIN 
          stones ON slab_inventory.stone_id = stones.id
        JOIN 
          suppliers ON stones.supplier_id = suppliers.id
        WHERE 
          slab_inventory.sale_id IS NULL
          AND (slab_inventory.is_sold = 0 OR slab_inventory.is_sold IS NULL)
      `;
      
      if (supplierFilter) {
        query += ` AND suppliers.id = ?`;
        queryParams.push(supplierFilter);
      }
      
      if (stoneFilter) {
        query += ` AND stones.id = ?`;
        queryParams.push(stoneFilter);
      }

      query += ` ORDER BY bundle ASC`;
      break;

    case "stones_sales":
      query = `
        SELECT 
          stones.id,
          '' as bundle,
          stones.name as stone_name,
          suppliers.supplier_name as supplier_name,
          '' as width,
          '' as length,
          0 as is_sold,
          NULL as cut_date,
          MAX(sales.sale_date) as sale_date,
          '' as customer_name,
          '' as seller_name,
          ROUND(SUM(slab_inventory.square_feet), 2) as square_feet,
          COUNT(DISTINCT slab_inventory.id) as notes,
          'Sold' as status
        FROM 
          stones
        JOIN 
          slab_inventory ON stones.id = slab_inventory.stone_id
        JOIN 
          suppliers ON stones.supplier_id = suppliers.id
        JOIN 
          sales ON slab_inventory.sale_id = sales.id
        WHERE 
          slab_inventory.sale_id IS NOT NULL
      `;

      if (fromDate) {
        query += ` AND DATE(sales.sale_date) >= ?`;
        queryParams.push(fromDate);
      }
      if (toDate) {
        query += ` AND DATE(sales.sale_date) <= ?`;
        queryParams.push(toDate);
      }
      
      if (supplierFilter) {
        query += ` AND suppliers.id = ?`;
        queryParams.push(supplierFilter);
      }
      
      if (stoneFilter) {
        query += ` AND stones.id = ?`;
        queryParams.push(stoneFilter);
      }

      query += ` GROUP BY stones.id, stones.name, suppliers.supplier_name ORDER BY SUM(slab_inventory.square_feet) DESC`;
      break;
  }

  slabs = await selectMany<SlabReport>(db, query, queryParams);

  return {
    slabs,
    suppliers,
    stones,
    reportType,
    fromDate,
    toDate,
    supplierId,
    stoneId
  };
};

const slabReportColumns: ColumnDef<SlabReport>[] = [
  {
    accessorKey: "bundle",
    header: ({ column }) => <SortableHeader column={column} title="Bundle" />,
    cell: ({ row }) => row.original.bundle || "-",
  },
  {
    accessorKey: "stone_name",
    header: ({ column }) => <SortableHeader column={column} title="Stone" />,
    cell: ({ row }) => row.original.stone_name || "-",
  },
  {
    accessorKey: "supplier_name",
    header: ({ column }) => <SortableHeader column={column} title="Supplier" />,
    cell: ({ row }) => row.original.supplier_name || "-", 
  },
  {
    accessorKey: "dimensions",
    header: ({ column }) => <SortableHeader column={column} title="Dimensions" />,
    cell: ({ row }) => {
      const length = row.original.length;
      const width = row.original.width;
      return (length && width) ? `${length}x${width}` : "-";
    },
  },
  {
    accessorKey: "square_feet",
    header: ({ column }) => <SortableHeader column={column} title="Sq. Feet" />,
    cell: ({ row }) => row.original.square_feet || "-",
  },
  {
    accessorKey: "cut_date",
    header: ({ column }) => <SortableHeader column={column} title="Cut Date" />,
    cell: ({ row }) => formatDate(row.original.cut_date),
    sortingFn: "datetime",
  },
  {
    accessorKey: "sale_date",
    header: ({ column }) => <SortableHeader column={column} title="Sale Date" />,
    cell: ({ row }) => formatDate(row.original.sale_date),
    sortingFn: "datetime",
  },
  {
    accessorKey: "customer_name",
    header: ({ column }) => <SortableHeader column={column} title="Customer" />,
    cell: ({ row }) => row.original.customer_name || "-",
  },
  {
    accessorKey: "seller_name",
    header: ({ column }) => <SortableHeader column={column} title="Sold By" />,
    cell: ({ row }) => row.original.seller_name || "-",
  },
  {
    accessorKey: "notes",
    header: ({ column }) => <SortableHeader column={column} title="Notes/Count" />,
    cell: ({ row }) => {
      if (row.original.status === 'Seller') {
        return `${row.original.notes} sales`;
      }
      return row.original.notes || "-";
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.original.status || "";
      
      let colorClass = "text-gray-500";
      if (status.includes("Cut")) {
        colorClass = "text-blue-500";
      } else if (status.includes("Sold") || status === "Seller") {
        colorClass = "text-green-500";
      }
      
      return <span className={`${colorClass} font-medium`}>{status}</span>;
    },
  },
];

const reportFormSchema = z.object({
  type: z.string(),
  supplier: z.string().optional(),
  stone: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export default function ReportsPage() {
  const { slabs, suppliers, stones, reportType, fromDate, toDate, supplierId, stoneId } = useLoaderData<typeof loader>();
  const [isExporting, setIsExporting] = useState(false);
  
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      type: reportType || "cut_slabs",
      supplier: supplierId || "all",
      stone: stoneId || "all",
      fromDate,
      toDate,
    },
  });
  
  useEffect(() => {
    form.reset({
      type: reportType || "cut_slabs",
      supplier: supplierId || "all",
      stone: stoneId || "all",
      fromDate,
      toDate,
    });
  }, [reportType, supplierId, stoneId, fromDate, toDate, form]);

  const watchReportType = form.watch("type");

  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      const headers = [
        "Bundle", "Stone", "Supplier", "Dimensions", "Square Feet", 
        "Cut Date", "Sale Date", "Customer", "Sold By", "Notes", "Status"
      ];
      
      const dataRows = slabs.map(slab => [
        slab.bundle || "",
        slab.stone_name || "",
        slab.supplier_name || "",
        (slab.length && slab.width) ? `${slab.length}x${slab.width}` : "",
        slab.square_feet || "",
        slab.cut_date ? formatDate(slab.cut_date) : "",
        slab.sale_date ? formatDate(slab.sale_date) : "",
        slab.customer_name || "",
        slab.seller_name || "",
        slab.status === 'Seller' ? `${slab.notes} sales` : (slab.notes || ""),
        slab.status || ""
      ]);
      
      const csvContent = [
        headers.join(","),
        ...dataRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case "cut_slabs": return "Cut Slabs Report";
      case "sold_slabs": return "Sold Slabs Report";
      case "inventory": return "Current Inventory Report";
      case "stones_sales": return "Stones Sales Report";
      default: return "Report";
    }
  };

  const reportTypeOptions = [
    { key: "cut_slabs", value: "Cut Slabs" },
    { key: "sold_slabs", value: "Sold Slabs" },
    { key: "inventory", value: "Current Inventory" },
    { key: "stones_sales", value: "Stones Sales" },
  ];

  const supplierOptions = [
    { key: "all", value: "All Suppliers" },
    ...suppliers.map(supplier => ({
      key: supplier.id.toString(),
      value: supplier.name
    }))
  ];

  const stoneOptions = [
    { key: "all", value: "All Stones" },
    ...stones.map(stone => ({
      key: stone.id.toString(),
      value: stone.name
    }))
  ];

  return (
    <PageLayout title={getReportTitle()}>
      <div className="mb-6 w-[600px] mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>Configure your report parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <Form method="get" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <SelectInput
                        name="Report Type"
                        field={field}
                        options={reportTypeOptions}
                      />
                    )}
                  />
                  
                  {watchReportType !== "sales_by_seller" && (
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <SelectInput
                          name="Supplier"
                          field={field}
                          options={supplierOptions}
                        />
                      )}
                    />
                  )}
                  
                  {watchReportType !== "sales_by_seller" && (
                    <FormField
                      control={form.control}
                      name="stone"
                      render={({ field }) => (
                        <SelectInput
                          name="Stone"
                          field={field}
                          options={stoneOptions}
                        />
                      )}
                    />
                  )}
                  
                  {watchReportType !== "inventory" && (
                    <>
                      <FormField
                        control={form.control}
                        name="fromDate"
                        render={({ field }) => (
                          <InputItem
                            name="From Date"
                            type="date"
                            field={field}
                          />
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="toDate"
                        render={({ field }) => (
                          <InputItem
                            name="To Date"
                            type="date"
                            field={field}
                          />
                        )}
                      />
                    </>
                  )}
                </div>
                
                <CardFooter className="px-0 pb-0 pt-4">
                  <div className="flex justify-between w-full">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      Generate Report
                    </Button>
                    
                    <Button 
                      type="button" 
                      onClick={exportToCSV}
                      disabled={isExporting || slabs.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isExporting ? "Exporting..." : "Export to CSV"}
                    </Button>
                  </div>
                </CardFooter>
              </Form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{getReportTitle()}</CardTitle>
          <CardDescription>
            Total items: {slabs.length}
            {fromDate && ` • From: ${fromDate}`}
            {toDate && ` • To: ${toDate}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable 
            columns={slabReportColumns} 
            data={slabs} 
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
} 