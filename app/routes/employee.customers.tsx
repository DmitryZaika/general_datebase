import { ColumnDef } from "@tanstack/react-table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { getEmployeeUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";
import { DataTable } from "~/components/ui/data-table";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const customers = await selectMany<Customer>(
    db,
    "SELECT id, name, email, phone, address FROM customers",
  );
  return {
    customers,
  };
};

const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    header: "Name of customer",
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
    accessorKey: "address",
    header: "Address",
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

export default function AdminCustomers() {
  const { customers } = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Customers List">
      <Link to={`add`} relative="path">
        <Button>Add new customer</Button>
      </Link>
      <DataTable columns={customerColumns} data={customers} />
      <Outlet />
    </PageLayout>
  );
}
