import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigation,
  Form as RemixForm,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { z } from "zod";
import { FileInput } from "~/components/molecules/FileInput";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { csrf } from "~/utils/csrf.server";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { deleteFile } from "~/utils/s3.server";
import { getAdminUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { useCustomForm } from "~/utils/useCustomForm";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

export const InstalledProjectsSchema = z.object({});
type TInstalledProjectsSchema = z.infer<typeof InstalledProjectsSchema>;

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
  const stoneId = parseInt(params.stone);

  if (request.method === "DELETE") {
    const form = await request.formData();
    const id = form.get("id");
    if (!id) {
      return forceRedirectError(request.headers, "No id provided");
    }
    const sid = parseInt(id.toString());
    await db.execute(`DELETE FROM main.installed_stones WHERE id = ?`, [sid]);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Image Deleted"));
    return redirect(request.url, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const { errors, data } = await parseMutliForm(
    request,
    InstalledProjectsSchema,
    "stones"
  );
  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";
  const stone = await selectId<{ url: string }>(
    db,
    "select url from stones WHERE id = ?",
    stoneId
  );

  try {
    await db.execute(
      `INSERT INTO installed_stones (url, stone_id) VALUES (?, ?)`,
      [data.file, stoneId]
    );
  } catch (error) {
    console.error("Error connecting to the database:", errors);
  }

  if (stone?.url && newFile) {
    deleteFile(stone.url);
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Image Added"));
  return redirect(request.url, {
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
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const stoneId = parseInt(params.stone);
  const stones = await selectMany<{ id: number; url: string }>(
    db,
    "select id, url from installed_stones WHERE stone_id = ?",
    [stoneId]
  );
  return { stones };
};

function AddImage() {
  const navigation = useNavigation();
  const form = useCustomForm<TInstalledProjectsSchema>(InstalledProjectsSchema);

  // Счётчик, который будем менять, чтобы "пересоздать" input
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    if (navigation.state === "idle") {
      form.reset();
      setInputKey((k) => k + 1);
    }
  }, [navigation.state, form]);

  return (
    <MultiPartForm form={form}>
      <div className="flex items-center space-x-4">
        <FormField
          control={form.control}
          name="file"
          render={({ field }) => (
            <FileInput
              key={inputKey}
              inputName="images"
              id="image"
              type="image"
              onChange={field.onChange}
            />
          )}
        />
        <Button type="submit" variant="blue">
          Add image
        </Button>
      </div>
    </MultiPartForm>
  );
}

export default function SelectImages() {
  const { stones } = useLoaderData<typeof loader>();
  return (
    <>
      <AddImage />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {stones.map((stone) => (
          <div key={stone.id} className="relative group">
            <img src={stone.url} alt="" className="w-full h-32 object-cover" />
            <div className="absolute top-2 right-2 flex justify-between items-start transition-opacity duration-300">
              <RemixForm
                method="delete"
                title="Delete Stone"
                aria-label="Delete Image"
              >
                <input type="hidden" name="id" value={stone.id} />
                <AuthenticityTokenInput />
                <Button
                  type="submit"
                  className="size-4 p-4 text-white bg-gray-800 bg-opacity-60 rounded-full transition"
                >
                  <FaTimes />
                </Button>
              </RemixForm>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
