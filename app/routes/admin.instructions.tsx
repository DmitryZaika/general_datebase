import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import {
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  Table,
  TableRow,
} from "~/components/ui/table";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
interface Instructions {
  id: number;
  title: string;
  parent_id: number;
  after_id: number;
  rich_text: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user;
  try {
    user = await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const instructions = await selectMany<Instructions>(
    db,
    "select id, title, parent_id, after_id, rich_text from instructions"
  );
  return { instructions, user };
};

export default function AdminInstructions() {
  const { instructions } = useLoaderData<typeof loader>();
  return (
    <PageLayout title="Instructions">
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of your Instructions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xl w-[200px]">Title</TableHead>{" "}
            <TableHead className="text-xl">Parent Id</TableHead>
            <TableHead className="text-xl">Order</TableHead>
            <TableHead className="text-xl text-right pr-4">
              Edit Instruction
            </TableHead>{" "}
            <TableHead className="text-right text-xl">
              Delete Instruction
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instructions.map((instruction) => (
            <TableRow key={instruction.id}>
              <TableCell className=" font-medium w-[200px]">
                {instruction.title}
              </TableCell>{" "}
              <TableCell>{instruction.parent_id}</TableCell>
              <TableCell>{instruction.after_id}</TableCell>
              <TableCell className="text-right pr-4">
                <Link to={`edit/${instruction.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${instruction.id}`} className="text-xl">
                  Delete
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Outlet />
    </PageLayout>
  );
}
