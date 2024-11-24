import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { selectId } from "~/utils/queryHelpers";
import { Button } from "~/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { getAdminUser } from "~/utils/session.server";

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const supplierId = parseInt(params.stone);
  if (!supplierId) {
    return json({ error: "Invalid supplier ID" }, { status: 400 });
  }

  try {
    const result = await db.execute(`DELETE FROM main.suppliers WHERE id = ?`, [
      supplierId,
    ]);
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
    return json({ error: "Failed to delete supplier" }, { status: 500 });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Supplier deleted"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const supplierId = params.supplier ? parseInt(params.supplier, 10) : null;
  if (!supplierId) {
    return { supplier_name: undefined };
  }

  const supplier = await selectId<{ supplier_name: string }>(
    db,
    "select supplier_name from suppliers WHERE id = ?",
    supplierId
  );

  if (!supplier) {
    return { supplier_name: undefined };
  }

  return {
    supplier_name: supplier ? supplier.supplier_name : undefined,
  };
};

export default function SuppliersAdd() {
  const navigate = useNavigate();
  const { supplier_name } = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete supplier</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {supplier_name || "this supplier"}?
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <Button type="submit">Delete supplier</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
