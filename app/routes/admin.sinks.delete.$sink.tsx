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

export async function action({ params }: ActionFunctionArgs) {
  const sinkId = params.sink;
  try {
    const result = await db.execute(`DELETE FROM main.sinks WHERE id = ?`, [
      sinkId,
    ]);
    console.log(result);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  return redirect("..");
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (params.sink === undefined) {
    return json({ name: undefined });
  }
  const sinkId = parseInt(params.sink);

  const sink = await selectId<{ name: string }>(
    db,
    "select name from sinks WHERE id = ?",
    sinkId
  );
  return json({
    name: sink?.name,
  });
};

export default function SinksAdd() {
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