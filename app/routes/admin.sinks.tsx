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
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Outlet, Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";

interface Sink {
  id: number;
  name: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const sinks = await selectMany<Sink>(db, "select id, name from sinks");
  return json({
    sinks,
  });
};

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add</Button>
      </Link>
      <Table>
        <TableCaption>A list of available sinks.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px] text-xl">Sink Name</TableHead>
            <TableHead className="text-right text-xl">Edit Sink</TableHead>
            <TableHead className="text-right text-xl">Delete Sink</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sinks.map((sink) => (
            <TableRow key={sink.id}>
              <TableCell className="font-medium w-[200px]">
                {sink.name}
              </TableCell>
              <TableCell className="text-right">
                <Link to={`edit/${sink.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="w-[200px] text-right">
                <Link to={`delete/${sink.id}`} className="text-xl">
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
