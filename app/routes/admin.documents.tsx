import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
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
    [user.company_id]
  );
  return { documents };
};

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();

  return (
    <div className="pt-24 sm:pt-0">
      <Link to={`add`} relative="path">
        <Button>Add Document</Button>
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
          {documents
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((document) => (
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
    </div>
  );
}
