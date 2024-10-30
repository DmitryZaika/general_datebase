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
import { json } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";

interface Supplier {
  id: number;
  website: string;
  supplier_name: string;
  manager: string;
  phone: string;
  email: string;
  notes: string;
}

export const loader = async () => {
  const suppliers = await selectMany<Supplier>(
    db,
    "SELECT website, supplier_name, manager, phone, email, notes from suppliers"
  );
  return json({
    suppliers,
  });
};

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of your recent invoices.</TableCaption>
        <TableHeader>
          <TableRow className="text-xl">
            <TableHead className="w-[100px]">WebSite</TableHead>
            <TableHead>Supplier Name</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Phone Number</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Edit</TableHead>
            <TableHead className="text-right">Delete</TableHead>
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
                <Link to={`edit/${supplier.id}`} className="text-xl">
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
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <Outlet />
    </>
  );
}
