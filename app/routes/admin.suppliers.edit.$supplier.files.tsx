import {
    LoaderFunctionArgs,
    ActionFunctionArgs,
    redirect,
    Form,
    useLoaderData,
    useNavigation,
    data
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
  
  const fileSchema = z.object({
    name: z.string().min(1),
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
    if (!params.supplier) {
      return forceRedirectError(request.headers, "No supplier id provided");
    }
    const supplierId = parseInt(params.supplier, 10);
    if (request.method === "DELETE") {
      const form = await request.formData();
      const id = form.get("id");
      if (!id) {
        return forceRedirectError(request.headers, "No id provided");
      }
      const fileId = parseInt(id.toString(), 10);
      const record = await selectId<{ url: string | null }>(
        db,
        "SELECT url FROM supplier_files WHERE id = ?",
        fileId,
      );
      await db.execute("DELETE FROM supplier_files WHERE id = ?", [fileId]);
      const session = await getSession(request.headers.get("Cookie"));
      if (record?.url) {
        deleteFile(record.url);
      }
      session.flash("message", toastData("Success", "File Deleted"));
      return data({ success: true }, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    const { errors, data: formData } = await parseMutliForm(request, fileSchema, "files");
    if (errors || !formData) {
      return { errors };
    }
    
    await db.execute(
      "INSERT INTO supplier_files (name, supplier_id, url) VALUES (?, ?, ?)",
      [formData.name, supplierId, formData.file ?? ""],
    );
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "File Added"));
    return data({ success: true }, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
  
  export async function loader({ request, params }: LoaderFunctionArgs) {
    await getAdminUser(request);
    if (!params.supplier) {
      return forceRedirectError(request.headers, "No supplier id provided");
    }
    const supplierId = parseInt(params.supplier, 10);
    const files = await selectMany<{
      id: number;
      name: string;
      url: string;
    }>(
      db,
      "SELECT id, name, url FROM supplier_files WHERE supplier_id = ?",
      [supplierId],
    );
    
    return { files };
  }
  
  export function AddFile() {
    const navigation = useNavigation();
    const [resetKey, setResetKey] = useState(0);
    const isSubmitting = navigation.state !== "idle";
    const form = useCustomOptionalForm(fileSchema, {
      defaultValues: {
        name: "",
        file: undefined,
      },
    });
    useEffect(() => {
      if (navigation.state === "idle") {
        form.reset({
          name: "",
          file: undefined,
        });
        setResetKey((prev) => prev + 1);
      }
    }, [navigation.state, form]);
    return (
      <MultiPartForm form={form} className="mb-5">
        <AuthenticityTokenInput />
        <div className="flex gap-2 [&>*:first-child]:w-[70%] [&>*:last-child]:w-[30%]">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <InputItem
                name="Name"
                className="-mb-3"
                placeholder="File name"
                field={field}
              />
            )}
          />
           <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FileInput
                label="Document"
                inputName="documents"
                id="document"
                type="pdf"
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Add File"}
        </Button>
      </MultiPartForm>
    );
  }
  
  export default function EditSupplierFiles() {
    const { files } = useLoaderData<typeof loader>();
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    return (
      <>
        <AddFile />
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex gap-1 justify-between items-center"
            >
              <div className="size-9 cursor-pointer flex items-center justify-center bg-gray-100">
                {file.url && 
                  <img
                    src={file.url}
                    alt={file.name}
                    className="size-9 object-cover"
                    onClick={() => setSelectedFile(file.url)}
                  />
                }

              </div>
              <div className="p-1.5 border w-full border-gray-300">
                <p className="w-full">{file.name}</p>
                <Form method="delete">
                  <AuthenticityTokenInput />
                  <input type="hidden" name="id" value={file.id} />
                  <Button type="submit" disabled={isSubmitting}>
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
  