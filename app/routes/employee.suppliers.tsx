import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { Link, useLoaderData } from "react-router";
import { LoaderFunctionArgs, redirect } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getEmployeeUser } from "~/utils/session.server";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/data-table";

interface Supplier {
  id: number;
  supplier_name: string;
  manager?: string;
  phone?: string;
  notes?: string;
  email?: string;
  website?: string;
}
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);
  const suppliers = await selectMany<Supplier>(
    db,
    "select id,website, supplier_name,  manager, phone, email, notes from suppliers WHERE company_id = ?",
    [user.company_id],
  );
  return { suppliers };
};

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: "supplier_name",
    header: "Supplier Name",
    cell: ({ row }) => (
      <Link
        to={row.original.website || ""}
        className="text-blue-600 hover:underline"
        target="_blank"
      >
        {row.original.supplier_name}
      </Link>
    ),
  },
  {
    accessorKey: "manager",
    header: "Manager",
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
];

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();
  return <DataTable columns={columns} data={suppliers} />;
}
