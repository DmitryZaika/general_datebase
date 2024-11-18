import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { selectId } from "~/utils/queryHelpers";
import { Button } from "~/components/ui/button";
import { deleteFile } from "~/utils/s3.server";

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
  const stoneId = parseInt(params.stone);
  const stone = await selectId<{ url: string }>(
    db,
    "select url from stones WHERE id = ?",
    stoneId
  );
  if (stone?.url) {
    deleteFile(stone.url);
  }

  try {
    const result = await db.execute(`DELETE FROM main.stones WHERE id = ?`, [
      stoneId,
    ]);
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Stone Deleted"));
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
  if (!params.stone) {
    return forceRedirectError(request.headers, "No image id provided");
  }
  const stoneId = parseInt(params.stone);

  const stone = await selectId<{ name: string }>(
    db,
    "select name from stones WHERE id = ?",
    stoneId
  );
  return json({
    name: stone?.name,
  });
};

export default function StonesAdd() {
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
          <DialogTitle>Delete Stone</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {name}?
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <Button type="submit">Delete Stone</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
