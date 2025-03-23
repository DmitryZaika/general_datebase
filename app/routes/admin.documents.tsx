import { ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "react-router";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";
import { ActionDropdown } from "~/components/molecules/DataTable/ActionDropdown";
import { DataTable } from "~/components/ui/data-table";

interface Document {
  id: number;
  name: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const user = await getAdminUser(request);
  const documents = await selectMany<Document>(
    db,
    "SELECT id, name FROM documents WHERE company_id = ?",
    [user.company_id],
  );
  return { documents };
};

const documentColumns: ColumnDef<Document>[] = [
  {
    accessorKey: "name",
    header: "Document Name",
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

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();

  return (
    <div className="pt-24 sm:pt-0">
      <Link to={`add`} relative="path">
        <Button>Add Document</Button>
      </Link>
      <DataTable columns={documentColumns} data={documents} />
      <Outlet />
    </div>
  );
}
