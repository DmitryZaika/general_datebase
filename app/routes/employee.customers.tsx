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
import { getEmployeeUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const customers = await selectMany<Customer>(
    db,
    "select name, email, phone, address from customers"
  );
  return {
    customers,
  };
};

export default function AdminCustomers() {
  const { customers } = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Customers List">
      <Link to={`add`} relative="path">
        <Button>Add new customer</Button>
      </Link>
      <Table>
        <TableCaption>A list of your recent customers.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xl w-[200px]">
              Name of customer
            </TableHead>{" "}
            <TableHead className="text-xl">Phone Number</TableHead>
            <TableHead className="text-xl pr-4">Email</TableHead>{" "}
            <TableHead className="text-xl">Addressr</TableHead>
            <TableHead className="text-right text-xl">Edit Customer</TableHead>
            <TableHead className="text-right text-xl">
              Delete customer
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className=" font-medium w-[200px]">
                {customer.name}
              </TableCell>{" "}
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.email}</TableCell>
              <TableCell>{customer.address}</TableCell>
              <TableCell className="text-right pr-4">
                <Link to={`edit/${customer.id}`} className="text-xl">
                  Edit
                </Link>
              </TableCell>
              <TableCell className="text-right w-[200px]">
                <Link to={`delete/${customer.id}`} className="text-xl">
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
    </PageLayout>
  );
}
