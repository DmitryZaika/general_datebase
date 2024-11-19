import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";

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
  const documents = await selectMany<Document>(
    db,
    "select id, name from documents"
  );
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
            <TableHead className="text-xl w-[200px]">Document Name</TableHead>
            <TableHead className="text-xl text-right">Edit Document</TableHead>
            <TableHead className="text-xl text-right">
              Delete Document
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="font-medium w-[200px]">
                {document.name}
              </TableCell>
              <TableCell className="text-right">
                <Link to={`edit/${document.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="w-[200px] text-right">
                <Link to={`delete/${document.id}`} className="text-xl">
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
