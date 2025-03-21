import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { Form, useLoaderData, useNavigate } from "react-router";
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
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

export async function action({ params, request }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }
  if (!params.supplier) {
    return forceRedirectError(request.headers, "No document id provided");
  }
  const supplierId = parseInt(params.supplier);
  if (!supplierId) {
    return { supplier_name: undefined };
  }

  try {
    await db.execute(`DELETE FROM main.suppliers WHERE id = ?`, [supplierId]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
    return { error: "Failed to delete supplier" };
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
    supplierId,
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
            <AuthenticityTokenInput />
            <Button autoFocus type="submit">
              Delete supplier
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
