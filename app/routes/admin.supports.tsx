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

interface Support {
  id: number;
  name: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const supports = await selectMany<Support>(
    db,
    "select id, name from supports"
  );
  return {
    supports,
  };
};

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of available supports.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px] text-xl">Support Name</TableHead>
            <TableHead className="text-right text-xl">Edit Support</TableHead>
            <TableHead className="text-right text-xl">Delete Support</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {supports.map((support) => (
            <TableRow key={support.id}>
              <TableCell className="font-medium w-[200px]">
                {support.name}
              </TableCell>
              <TableCell className="text-right">
                <Link to={`edit/${support.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${support.id}`} className="text-xl">
                  Delete
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <Outlet />
    </>
  );
}
