//// filepath: c:\Users\sarah\general_datebase\app\routes\employee.stones.slabs.$stone.tsx
import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { useState } from "react";

interface Slab {
  id: number;
  bundle: string;
  url: string | null;
  sold: boolean | number;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  const stone = await selectId<{ name: string }>(
    db,
    "SELECT name FROM stones WHERE id = ?",
    stoneId
  );
  if (!stone) {
    return forceRedirectError(request.headers, "No stone found for given ID");
  }
  const slabs = await selectMany<Slab>(
    db,
    "SELECT id, bundle, url, is_sold FROM slab_inventory WHERE stone_id = ?",
    [stoneId]
  );
  console.log(slabs);
  return { slabs, stone };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  await csrf.validate(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const formData = await request.formData();
  const slabId = formData.get("slabId");
  if (!slabId) {
    return forceRedirectError(request.headers, "No slabId provided");
  }
  const slab = await selectId<{ sold: number }>(
    db,
    "SELECT sold FROM slab_inventory WHERE id = ?",
    parseInt(slabId.toString(), 10)
  );
  if (!slab) {
    return forceRedirectError(request.headers, "No slab found for given ID");
  }
  const newValue = slab.sold === 1 ? 0 : 1;
  await db.execute("UPDATE slab_inventory SET sold = ? WHERE id = ?", [
    newValue,
    slabId,
  ]);
  const session = await getSession(request.headers.get("Cookie"));
  session.flash(
    "message",
    toastData("Success", `Slab ${newValue ? "Sold" : "Unsold"}`)
  );
  return redirect(request.url, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function SlabsModal() {
  const { slabs, stone } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) history.back();
      }}
    >
      <DialogContent className="h-auto bg-white p-3 rounded-md">
        <h2 className="text-xl font-bold mb-4">Slabs for {stone.name}</h2>
        <div className="flex flex-col gap-2">
          {slabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            slabs.map((slab) => {
              const isSold = !!slab.sold;
              return (
                <div
                  key={slab.id}
                  className="border p-2 rounded flex items-center gap-2"
                >
                  <img
                    src={slab.url ?? "/placeholder.png"}
                    alt="Slab"
                    className="w-20 h-20 object-cover cursor-pointer"
                    onClick={() => setSelectedImage(slab.url)}
                  />
                  <span
                    className={`font-bold ${
                      isSold ? "text-red-600" : "text-black"
                    }`}
                  >
                    {slab.bundle}
                  </span>
                  <Form method="post">
                    <AuthenticityTokenInput />
                    <input type="hidden" name="slabId" value={slab.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      className="ml-auto w-full"
                    >
                      {isSold ? "Unsell" : "Sell"}
                    </Button>
                  </Form>
                </div>
              );
            })
          )}
        </div>
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            onClick={() => setSelectedImage(null)}
          >
            <img
              src={selectedImage}
              alt="Slab Zoom"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
