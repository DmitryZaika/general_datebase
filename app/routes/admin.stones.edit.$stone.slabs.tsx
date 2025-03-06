import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  Form,
  useLoaderData,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { getAdminUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { FaTimes } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";

const slabSchema = z.object({ bundle: z.string().min(1) });

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect("/login?error=" + encodeURIComponent(String(error)));
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  const slabs = await selectMany<{ id: number; bundle: string }>(
    db,
    "SELECT id, bundle FROM slab_inventory WHERE stone_id = ?",
    [stoneId]
  );
  return { slabs };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect("/login?error=" + encodeURIComponent(String(error)));
  }
  try {
    await csrf.validate(request);
  } catch {
    return { error: "Invalid CSRF token" };
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  if (request.method === "DELETE") {
    const form = await request.formData();
    const id = form.get("id");
    if (!id) {
      return forceRedirectError(request.headers, "No slab id provided");
    }
    const slabId = parseInt(id.toString(), 10);
    const record = await selectId<{ bundle: string | null }>(
      db,
      "SELECT bundle FROM slab_inventory WHERE id = ?",
      slabId
    );
    if (!record) {
      return forceRedirectError(request.headers, "Slab not found");
    }
    await db.execute("DELETE FROM slab_inventory WHERE id = ?", [slabId]);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab Deleted"));
    return redirect(request.url, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
  const form = await request.formData();
  const bundle = form.get("bundle");
  if (!bundle) {
    return { errors: { bundle: "Required" } };
  }
  const parsed = slabSchema.safeParse({ bundle: bundle.toString() });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  await db.execute(
    "INSERT INTO slab_inventory (bundle, stone_id, is_sold) VALUES (?, ?, 0)",
    [bundle.toString(), stoneId]
  );
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Slab Added"));
  return redirect(request.url, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export function AddSlab() {
  const navigation = useNavigation();
  const [bundle, setBundle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Если сабмит завершён, очищаем инпут и фокусируем его
    if (navigation.state === "idle") {
      setBundle("");
      inputRef.current?.focus();
    }
  }, [navigation.state]);

  return (
    <Form method="post" className="mb-5">
      <AuthenticityTokenInput />
      <input
        className="border-2 p-1.5"
        ref={inputRef}
        type="text"
        name="bundle"
        value={bundle}
        onChange={(e) => setBundle(e.target.value)}
        autoFocus
      />
      <Button type="submit">Add Slab</Button>
    </Form>
  );
}

export default function EditStoneSlabs() {
  const { slabs } = useLoaderData<typeof loader>();
  return (
    <>
      <AddSlab />
      <div className="flex flex-col gap-2">
        {slabs.map((slab, index) => (
          <div key={slab.id} className="flex justify-between items-center">
            <p className="whitespace-nowrap mr-2">Slab {index + 1}</p>
            <div className="border-r-2 p-2 border w-full border-gray-300">
              <p className="w-full">{slab.bundle}</p>
            </div>
            <div>
              <Form method="delete">
                <AuthenticityTokenInput />
                <input type="hidden" name="id" value={slab.id} />
                <Button type="submit">
                  <FaTimes />
                </Button>
              </Form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
