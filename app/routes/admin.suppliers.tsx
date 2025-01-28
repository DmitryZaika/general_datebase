import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";

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
    [user.company_id]
  );
  return {
    suppliers,
  };
};

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add Supplier</Button>
      </Link>
      <Table>
        <TableCaption>A list of suppliers.</TableCaption>
        <TableHeader>
          <TableRow className="text-xl">
            <TableHead className="w-[100px]">WebSite</TableHead>
            <TableHead>Supplier Name</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Phone Number</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right text-xl">Edit Supplier</TableHead>
            <TableHead className="text-right">Delete Supplier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.website}</TableCell>
              <TableCell className="font-medium">
                {supplier.supplier_name}
              </TableCell>
              <TableCell className="font-medium">{supplier.manager}</TableCell>
              <TableCell className="font-medium">{supplier.phone}</TableCell>
              <TableCell className="font-medium">{supplier.email}</TableCell>
              <TableCell className="font-medium">{supplier.notes}</TableCell>
              <TableCell>
                <Link to={`edit/${supplier.id}`} className="text-xl text-right">
                  Edit
                </Link>
              </TableCell>

              <TableCell className="text-right">
                <Link to={`delete/${supplier.id}`} className="text-xl">
                  Delete
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Outlet />
    </>
  );
}
