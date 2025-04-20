import { ActionFunctionArgs, data, redirect, useLocation,  } from "react-router";
import { Form,  useNavigate } from "react-router";
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
import {  forceRedirectError, toastData } from "~/utils/toastHelpers";
import {  getEmployeeUser } from "~/utils/session.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

export async function action({ params, request }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.sale) {
    return forceRedirectError(request.headers, "No stone id provided");
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';


  try {

    await db.execute(
      "UPDATE slab_inventory SET sale_id = NULL, notes = NULL WHERE sale_id = ?",
      [params.sale]
    );
    await db.execute(
      "UPDATE sinks SET sale_id = NULL, is_deleted = 0 WHERE sale_id = ?",
      [params.sale]
    );
    await db.execute(
      "UPDATE sales SET status = 'canceled' WHERE id = ?",
      [params.sale]
    );
 
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab marked as unsold"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (error) {
    console.error("Error unselling slab:", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to unsell slab"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } 
}

export default function SupportsAdd() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel the transaction?
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <AuthenticityTokenInput />
            <Button autoFocus type="submit">
              Cancel Transaction
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
