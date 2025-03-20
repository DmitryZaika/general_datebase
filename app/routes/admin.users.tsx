import { ColumnDef } from "@tanstack/react-table"
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";
import { DataTable } from "~/components/ui/data-table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { Link, Outlet, useLoaderData } from "react-router";
import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  Table,
  TableRow,
} from "~/components/ui/table";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getSuperUser } from "~/utils/session.server";
interface User {
  id: number;
  name: string;
  email: string;
  phone_number: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getSuperUser(request);
  const users = await selectMany<User>(
    db,
    " select id, name, email, phone_number from main.users WHERE is_deleted = 0"
  );

  return { users };
};

const adminColumns: ColumnDef<User>[] =[
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone_number",
    header: "Phone Number",
  },
    {
    id: "actions",
    cell: ({ row }) => {
      return (
        <ActionDropdown actions={{edit:`edit/${row.original.id}`, delete: `delete/${row.original.id}` }}/>
      )
    }
    }
]

export default function Adminusers() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Users">
      <Link to={`add`} relative="path">
        <Button>Add User</Button>
      </Link>
      <DataTable columns={adminColumns} data={users}/>
      <Outlet />
    </PageLayout>
  );
}
