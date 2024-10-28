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

interface Document {
  id: number;
  name: string;
}

export const loader = async () => {
  const documents = await selectMany<Document>(db, "select * from documents");
  return json({
    documents,
  });
};

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of available documents.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Invoice</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="font-medium">{document.name}</TableCell>

              <TableCell>
                {" "}
                <Link to={`edit/${document.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right">
                {" "}
                <Link to={`delete/${document.id}`} className="text-xl">
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
