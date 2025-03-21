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
  const imageId = params.image ? parseInt(params.image, 10) : null;
  if (!imageId) {
    return { error: "Invalid image ID" };
  }
  try {
    const result = await db.execute(`DELETE FROM main.images WHERE id = ?`, [
      imageId,
    ]);
  } catch (error) {
    console.error("Error connecting to the database: ", error);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "image Deleted"));
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
  if (!params.image) {
    return forceRedirectError(request.headers, "No image id provided");
  }
  const imageId = parseInt(params.image);

  const image = await selectId<{ name: string }>(
    db,
    "select name from images WHERE id = ?",
    imageId,
  );
  return {
    name: image?.name || "this image",
  };
};

export default function ImagesAdd() {
  const navigate = useNavigate();
  const { name } = useLoaderData<{ name: string | undefined }>();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate("..");
    }
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete image</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {name ?? "this image"}?
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <AuthenticityTokenInput />
            <Button autoFocus type="submit">
              Delete image
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
