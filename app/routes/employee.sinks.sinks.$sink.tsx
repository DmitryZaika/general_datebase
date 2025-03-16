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
import { selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { Dialog, DialogContent, DialogClose } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { useRef, useState } from "react";

interface Sink {
  id: number;
  name: string;
  type: string;
  amount: number;
  url: string | null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }
  const sinkId = parseInt(params.sink, 10);
  const sink = await selectId<Sink>(
    db,
    "SELECT id, name, type, amount, url FROM sinks WHERE id = ?",
    sinkId
  );
  if (!sink) {
    return forceRedirectError(request.headers, "No sink found for given ID");
  }
  return { sink };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  await csrf.validate(request);

  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }

  const formData = await request.formData();
  const sinkId = Number(formData.get("sinkId"));
  if (!sinkId) {
    return forceRedirectError(request.headers, "No sinkId provided");
  }

  const sink = await selectId<{ amount: number }>(
    db,
    "SELECT amount FROM sinks WHERE id = ?",
    sinkId
  );
  if (!sink) {
    return forceRedirectError(request.headers, "No sink found for given ID");
  }

  await db.execute(
    "UPDATE sinks SET amount = GREATEST(amount - 1, 0) WHERE id = ?",
    [sinkId]
  );

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink sold"));

  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function SinksModal() {
  const { sink } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) history.back();
      }}
    >
      <DialogContent className="p-5 bg-white rounded-md shadow-lg text-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center">{sink.type}</h2>

        {sink.amount === 0 ? (
          <p className="text-center text-gray-500">No sinks available</p>
        ) : (
          <div className="flex items-center gap-4 p-3 rounded-lg border border-gray-200">
            <img
              src={sink.url ?? "/placeholder.png"}
              alt={sink.name}
              className="w-20 h-20 object-cover cursor-pointer rounded"
              onClick={() => {
                if (sink.url) {
                  setSelectedImage(sink.url);
                }
              }}
            />
            <span className="flex-1 text-center font-semibold text-gray-800">
              {sink.name}
            </span>
            <span className="font-semibold text-gray-800">{sink.amount}</span>
            <Form method="post" ref={formRef} className="ml-4">
              <AuthenticityTokenInput />
              <input type="hidden" name="sinkId" value={sink.id} />
              <Button
                type="submit"
                className="px-4 py-2 transition-colors duration-300"
              >
                Sell
              </Button>
            </Form>
          </div>
        )}

        <Dialog
          open={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1">
            <DialogClose className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <span className="sr-only">Close</span>
            </DialogClose>

            {selectedImage && (
              <img
                src={selectedImage}
                alt="Full size"
                className="max-w-full max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
