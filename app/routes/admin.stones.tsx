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
import { json, redirect, LoaderFunctionArgs } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";

interface Stone {
  id: number;
  name: string;
  type: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user;
  try {
    user = await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const stones = await selectMany<Stone>(
    db,
    "select id, name, type from stones"
  );
  return json({ stones, user });
};

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of your recent stones.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xl w-[200px]">Name of Stone</TableHead>{" "}
            <TableHead className="text-xl">Type</TableHead>
            <TableHead className="text-xl text-right pr-4">
              Edit Stone
            </TableHead>{" "}
            <TableHead className="text-right text-xl">Delete Stone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stones.map((stone) => (
            <TableRow key={stone.id}>
              <TableCell className=" font-medium w-[200px]">
                {stone.name}
              </TableCell>{" "}
              <TableCell>{stone.type}</TableCell>
              <TableCell className="text-right pr-4">
                <Link to={`edit/${stone.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${stone.id}`} className="text-xl">
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
