import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

interface Supplier {
  id: number;
  supplier_name: string;
  manager?: string;
  phone?: string;
  notes?: string;
  email?: string;
  website?: string;
}
export const loader = async () => {
  const suppliers = await selectMany<Supplier>(
    db,
    "select id, website, manager, supplier_name, phone, email from suppliers"
  );
  return json({ suppliers });
};

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();
  return (
    <Accordion type="single">
      <AccordionItem value="suppliers">
        <AccordionTrigger>Suppliers</AccordionTrigger>
        <AccordionContent>
          <Button className="mb-4">Add New Supplier</Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {supplier.supplier_name}
                      </a>
                    </TableCell>
                    <TableCell>{supplier.manager || "-"}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>{supplier.email || "-"}</TableCell>
                    <TableCell>
                      {supplier.website ? (
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {supplier.website}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{supplier.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
