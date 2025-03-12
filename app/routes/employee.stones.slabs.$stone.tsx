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
  is_sold: boolean | number;
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
  const slab = await selectId<{ is_sold: number }>(
    db,
    "SELECT is_sold FROM slab_inventory WHERE id = ?",
    parseInt(slabId.toString(), 10)
  );
  if (!slab) {
    return forceRedirectError(request.headers, "No slab found for given ID");
  }
  const newValue = slab.is_sold === 1 ? 0 : 1;
  await db.execute("UPDATE slab_inventory SET is_sold = ? WHERE id = ?", [
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
      <DialogContent className="p-5 bg-white rounded-md shadow-lg text-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Slabs for {stone.name}
        </h2>
        <div className="flex flex-col gap-4">
          {slabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            slabs.map((slab) => {
              const isSold = !!slab.is_sold;
              return (
                <div
                  key={slab.id}
                  className={`flex items-center  gap-4 p-3 rounded-lg border border-gray-200 ${
                    isSold ? "bg-red-200" : "bg-white"
                  }`}
                >
                  <img
                    src={slab.url ?? "/placeholder.png"}
                    alt="Slab"
                    className="w-15 h-15 object-cover cursor-pointer rounded"
                    onClick={() => setSelectedImage(slab.url)}
                  />
                  <span
                    className={`font-semibold ${
                      isSold ? "text-red-900" : "text-gray-800"
                    }`}
                  >
                    {slab.bundle}
                  </span>
                  <Form method="post" className="ml-auto">
                    <AuthenticityTokenInput />
                    <input type="hidden" name="slabId" value={slab.id} />
                    <Button type="submit" className="px-4 py-2">
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
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
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
