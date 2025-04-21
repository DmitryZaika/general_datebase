import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import {
  Link,
  useLoaderData,
  useNavigation,
  Form as RemixForm,
} from "react-router";
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
  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }
  const sinkId = parseInt(params.sink);

  if (request.method === "DELETE") {
    const form = await request.formData();
    const id = form.get("id");
    if (!id) {
      return forceRedirectError(request.headers, "No id provided");
    }
    const sid = parseInt(id.toString());
    const result = await selectId<{ url: string | null }>(
      db,
      "SELECT url FROM installed_sinks WHERE id = ?",
      sid,
    );
    await db.execute(`DELETE FROM main.installed_sinks WHERE id = ?`, [sid]);
    const session = await getSession(request.headers.get("Cookie"));
    if (result?.url) {
      deleteFile(result.url);
    }
    session.flash("message", toastData("Success", "Image Deleted"));
    return redirect(request.url, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const { errors, data } = await parseMutliForm(
    request,
    InstalledProjectsSchema,
    "sinks",
  );
  if (errors || !data) {
    return { errors };
  }

  const sink = await selectId<{ url: string }>(
    db,
    "select url from sink_type WHERE id = ?",
    sinkId,
  );

  try {
    await db.execute(
      `INSERT INTO installed_sinks (url, sink_id) VALUES (?, ?)`,
      [data.file, sinkId],
    );
  } catch (error) {
    console.error("Error connecting to the database:", errors);
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
  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }
  const sinkId = parseInt(params.sink);
  const sinks = await selectMany<{ id: number; url: string }>(
    db,
    "select id, url from installed_sinks WHERE sink_id = ?",
    [sinkId],
  );
  return { sinks };
};

function AddImage() {
  const navigation = useNavigation();
  const form = useCustomForm<TInstalledProjectsSchema>(InstalledProjectsSchema);

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
  const { sinks } = useLoaderData<typeof loader>();
  return (
    <>
      <AddImage />
      <div className="grid grid-cols-2  md:grid-cols-3 gap-4 mt-4">
        {sinks.map((sink) => (
          <div key={sink.id} className="relative group">
            <img src={sink.url} alt="" className="w-full h-32 object-cover" />
            <div className="absolute top-2 right-2 flex justify-between items-start transition-opacity duration-300">
              <RemixForm
                method="delete"
                title="Delete Sink"
                aria-label="Delete Image"
              >
                <input type="hidden" name="id" value={sink.id} />
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
