import {
  ActionFunctionArgs,
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
  const sinkId = params.sink;
  try {
    const result = await db.execute(`DELETE FROM main.sinks WHERE id = ?`, [
      sinkId,
    ]);
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink Deleted"));
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
  if (!params.sink) {
    return forceRedirectError(request.headers, "No Sink id provided");
  }
  const sinkId = parseInt(params.sink);

  const sink = await selectId<{ name: string }>(
    db,
    "select name from sinks WHERE id = ?",
    sinkId
  );
  return {
    name: sink?.name,
  };
};

export default function SinksDelete() {
  const navigate = useNavigate();
  const { name } = useLoaderData<typeof loader>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Sink</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {name}?
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <Button type="submit">Delete Sink</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
