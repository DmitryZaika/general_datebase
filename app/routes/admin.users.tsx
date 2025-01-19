import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  Table,
  TableRow,
} from "~/components/ui/table";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getSuperUser } from "~/utils/session.server";
interface Users {
  id: number;
  name: string;
  email: string;
  phone_number: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getSuperUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getSuperUser(request);
  const users = await selectMany<Users>(
    db,
    " select id, name, email, phone_number from main.users WHERE is_deleted = 0"
  );
  console.log("Loaded users:", users);
  return { users };
};

export default function Adminusers() {
  const { users } = useLoaderData<typeof loader>();
  console.log("Loaded users:", users);
  return (
    <PageLayout title="Users">
      <Link to={`add`} relative="path">
        <Button>Add User</Button>
      </Link>
      <Table>
        <TableCaption>A list of users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xl w-[200px]">Name</TableHead>{" "}
            <TableHead className="text-xl">Email</TableHead>
            <TableHead className="text-xl"> Phone number</TableHead>
            <TableHead className="text-xl text-right pr-4">
              Edit User
            </TableHead>{" "}
            <TableHead className="text-right text-xl">Delete User</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.phone_number}</TableCell>
              <TableCell className="text-right pr-4">
                <Link to={`edit/${user.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${user.id}`} className="text-xl">
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
