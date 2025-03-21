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
import { useEffect, useState } from "react";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { FileInput } from "~/components/molecules/FileInput";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { deleteFile } from "~/utils/s3.server";
import { Dialog, DialogContent, DialogClose } from "~/components/ui/dialog";

const slabSchema = z.object({
  bundle: z.string().min(1),
  height: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
});

export async function action({ request, params }: ActionFunctionArgs) {
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
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  if (request.method === "DELETE") {
    const form = await request.formData();
    const id = form.get("id");
    if (!id) {
      return forceRedirectError(request.headers, "No id provided");
    }
    const slabId = parseInt(id.toString(), 10);
    const record = await selectId<{ url: string | null }>(
      db,
      "SELECT url FROM slab_inventory WHERE id = ?",
      slabId
    );
    await db.execute("DELETE FROM slab_inventory WHERE id = ?", [slabId]);
    const session = await getSession(request.headers.get("Cookie"));
    if (record?.url) {
      deleteFile(record.url);
    }
    session.flash("message", toastData("Success", "Image Deleted"));
    return redirect(request.url, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
  const { errors, data } = await parseMutliForm(request, slabSchema, "stones");
  if (errors || !data) {
    return { errors };
  }
  if (data.height === 0 && data.width === 0) {
    const [stoneRecord] = await selectMany<{ width: number; height: number }>(
      db,
      "SELECT width, height FROM stones WHERE stone_id = ? LIMIT 1",
      [stoneId]
    );
    data.height = stoneRecord?.height ?? 0;
    data.width = stoneRecord?.width ?? 0;
  }
  await db.execute(
    "INSERT INTO slab_inventory (bundle, stone_id, url, width, height) VALUES (?, ?, ?, ?, ?)",
    [data.bundle, stoneId, data.file ?? "", data.width, data.height]
  );
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Image Added"));
  return redirect(request.url, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await getAdminUser(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone, 10);
  const slabs = await selectMany<{
    id: number;
    bundle: string;
    url: string;
    width: number;
    height: number;
  }>(
    db,
    "SELECT id, bundle, url, width, height FROM slab_inventory WHERE stone_id = ?",
    [stoneId]
  );
  const [stone] = await selectMany<{
    id: number;
    width: number;
    height: number;
    url: string;
  }>(db, "SELECT id, width, height, url FROM stones WHERE id = ? LIMIT 1", [
    stoneId,
  ]);
  return { slabs, stone };
}

export function AddSlab() {
  const { stone } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [resetKey, setResetKey] = useState(0);
  const isSubmitting = navigation.state === "submitting";
  const form = useCustomOptionalForm(slabSchema, {
    defaultValues: {
      bundle: "",
      file: stone.url || undefined,
      height: "",
      width: "",
    },
  });
  useEffect(() => {
    if (navigation.state === "idle") {
      form.reset({
        bundle: "",
        file: undefined,
        height: stone?.height ?? "",
        width: stone?.width ?? "",
      });
      setResetKey((prev) => prev + 1);
    }
  }, [navigation.state, stone, form]);
  return (
    <MultiPartForm form={form} className="mb-5">
      <AuthenticityTokenInput />
      <div className="flex gap-2 [&>*:first-child]:w-[70%] [&>*:last-child]:w-[30%]">
        <FormField
          control={form.control}
          name="bundle"
          render={({ field }) => (
            <InputItem
              name="Bundle"
              className="-mb-3"
              placeholder="Slab"
              field={field}
            />
          )}
        />
        <FormField
          key={resetKey}
          control={form.control}
          name="file"
          render={({ field }) => (
            <FileInput
              className="-mb-3"
              inputName="stones"
              type="image"
              id="image"
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="height"
          render={({ field }) => (
            <InputItem
              name="Height"
              className="-mb-3"
              placeholder={stone?.height?.toString() || "Height"}
              field={field}
            />
          )}
        />
        <FormField
          control={form.control}
          name="width"
          render={({ field }) => (
            <InputItem
              name="Width"
              className="-mb-3"
              placeholder={stone?.width?.toString() || "Width"}
              field={field}
            />
          )}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Add Slab"}
      </Button>
    </MultiPartForm>
  );
}

export default function EditStoneSlabs() {
  const { slabs, stone } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  return (
    <>
      <AddSlab />
      <div className="flex flex-col gap-2">
        {slabs.map((slab) => (
          <div
            key={slab.id}
            className="flex gap-1 justify-between items-center"
          >
            <img
              src={slab.url === "undefined" ? stone.url : slab.url}
              alt="Slab"
              className="size-9 cursor-pointer"
              onClick={() => setSelectedImage(slab.url)}
            />
            <div className="p-1.5 border w-full  border-gray-300">
              <p className="w-full">Slab number: {slab.bundle}</p>
              <p>
                Size {slab.height} x {slab.width}
              </p>
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
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1">
          <DialogClose className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <span className="sr-only">Close</span>
          </DialogClose>
          {selectedImage && (
            <img
              src={selectedImage === "undefined" ? stone.url : selectedImage}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
