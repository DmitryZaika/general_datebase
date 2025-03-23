import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/data-table";
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";

interface Supplier {
  id: number;
  website: string;
  supplier_name: string;
  manager: string;
  phone: string;
  email: string;
  notes: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getAdminUser(request);
  const suppliers = await selectMany<Supplier>(
    db,
    "SELECT id, website, supplier_name, manager, phone, email, notes from suppliers WHERE company_id = ?",
    [user.company_id],
  );
  return {
    suppliers,
  };
};

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: "website",
    header: ({ column }) => <SortableHeader column={column} title="Website" />,
  },
  {
    accessorKey: "supplier_name",
    header: ({ column }) => (
      <SortableHeader column={column} title="Supplier Name" />
    ),
  },
  {
    accessorKey: "manager",
    header: ({ column }) => <SortableHeader column={column} title="Manager" />,
  },
  {
    accessorKey: "phone",
    header: "Phone Number",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "notes",
    header: "Notes",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ActionDropdown
          actions={{
            edit: `edit/${row.original.id}`,
            delete: `delete/${row.original.id}`,
          }}
        />
      );
    },
  },
];

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();

  return (
    <div className="pt-24 sm:pt-0">
      <Link to={`add`} relative="path">
        <Button>Add Supplier</Button>
      </Link>
      <DataTable columns={columns} data={suppliers} />
      <Outlet />
    </div>
  );
}
