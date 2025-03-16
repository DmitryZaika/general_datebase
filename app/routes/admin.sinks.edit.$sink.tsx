import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import {
  useNavigate,
  useLoaderData,
  useNavigation,
  Outlet,
} from "react-router";
import { FormField } from "../components/ui/form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { selectId, selectMany } from "~/utils/queryHelpers";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { MultiPartForm } from "~/components/molecules/MultiPartForm";
import { FileInput } from "~/components/molecules/FileInput";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { parseMutliForm } from "~/utils/parseMultiForm";
import { useCustomOptionalForm } from "~/utils/useCustomForm";
import { deleteFile } from "~/utils/s3.server";
import { getAdminUser } from "~/utils/session.server";
import { csrf } from "~/utils/csrf.server";
import { SelectInput } from "~/components/molecules/SelectItem";
import { SwitchItem } from "~/components/molecules/SwitchItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { sinkSchema } from "~/schemas/sinks";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getAdminUser(request).catch((err) => {
    return redirect(`/login?error=${err}`);
  });
  await csrf.validate(request).catch(() => {
    return { error: "Invalid CSRF token" };
  });
  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }
  const sinkId = parseInt(params.sink, 10);
  const { errors, data } = await parseMutliForm(request, sinkSchema, "sinks");
  if (errors || !data) {
    return { errors };
  }
  const newFile = data.file && data.file !== "undefined";
  const sink = await selectId<{ url: string }>(
    db,
    "SELECT url FROM sinks WHERE id = ?",
    sinkId
  );
  try {
    if (newFile) {
      await db.execute(
        `UPDATE sinks
         SET name = ?, type = ?, url = ?, is_display = ?, supplier_id = ?,  height = ?, width = ?, amount = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.file,
          data.is_display,
          data.supplier_id,
          data.height,
          data.width,
          data.amount,
          sinkId,
        ]
      );
    } else {
      await db.execute(
        `UPDATE sinks
         SET name = ?, type = ?, is_display = ?, supplier_id = ?, height = ?, width = ?, amount = ?
         WHERE id = ?`,
        [
          data.name,
          data.type,
          data.is_display,
          data.supplier_id,
          data.height,
          data.width,
          data.amount,
          sinkId,
        ]
      );
    }
  } catch (error) {
    console.error("Error updating sink: ", error);
  }
  if (sink?.url && newFile) {
    await deleteFile(sink.url);
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sink Edited"));
  return redirect("..", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await getAdminUser(request).catch((err) => {
    return redirect(`/login?error=${err}`);
  });
  if (!params.sink) {
    return forceRedirectError(request.headers, "No sink id provided");
  }
  const sinkId = parseInt(params.sink, 10);
  const sink = await selectId<{
    name: string;
    type: string;
    url: string;
    is_display: boolean;
    supplier_id: string;
    height: string;
    width: string;
    amount: number | null;
  }>(
    db,
    "SELECT name, type, url, is_display, supplier_id, height, width, amount FROM sinks WHERE id = ?",
    sinkId
  );
  if (!sink) {
    return forceRedirectError(request.headers, "No sink found");
  }
  const suppliers = await selectMany<{
    id: number;
    supplier_name: string;
  }>(db, "SELECT id, supplier_name FROM suppliers WHERE company_id = ?", [
    user.company_id,
  ]);
  return {
    sink,
    suppliers,
  };
};

function SinkInformation({
  sinkData,
  suppliers,
  refresh,
}: {
  sinkData: ReturnType<typeof loader>["sink"];
  suppliers: {
    id: number;
    supplier_name: string;
  }[];
  refresh: () => void;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const { name, type, url, is_display, supplier_id, height, width, amount } =
    sinkData;
  const defaultValues = {
    name,
    type,
    url: "",
    is_display,
    supplier_id,
    height,
    width,
    amount,
  };
  const form = useCustomOptionalForm(sinkSchema, defaultValues);

  return (
    <MultiPartForm form={form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <InputItem name="Name" placeholder="Sink name" field={field} />
        )}
      />
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <SelectInput
              name="Type"
              placeholder="Sink Type"
              field={field}
              options={[
                "Stainless 18 gauge",
                "Stainless 16 gauge",
                "Granite Composite",
                "Ceramic",
                "Farm House",
              ]}
            />
          )}
        />
        <FormField
          control={form.control}
          name="file"
          render={({ field }) => (
            <FileInput
              inputName="sinks"
              id="image"
              type="image"
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="flex justify-between gap-2">
        <FormField
          control={form.control}
          name="is_display"
          render={({ field }) => <SwitchItem field={field} name="Display" />}
        />
        <FormField
          control={form.control}
          name="supplier_id"
          render={({ field }) => (
            <SelectInput
              name="Supplier"
              placeholder="Supplier"
              field={field}
              options={suppliers.map((item) => ({
                key: item.id.toString(),
                value: item.supplier_name,
              }))}
            />
          )}
        />
      </div>
      {url ? <img src={url} alt={name} className="w-48 mt-4 mx-auto" /> : null}
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="height"
          render={({ field }) => (
            <InputItem name="Height" placeholder="Sink height" field={field} />
          )}
        />
        <FormField
          control={form.control}
          name="width"
          render={({ field }) => (
            <InputItem name="Width" placeholder="Sink width" field={field} />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <InputItem name="Amount" placeholder="Sink Amount" field={field} />
        )}
      />

      <DialogFooter className="mt-4">
        <LoadingButton loading={isSubmitting}>Edit Sink</LoadingButton>
      </DialogFooter>
    </MultiPartForm>
  );
}
export default function SinksEdit() {
  const navigate = useNavigate();
  const { sink, suppliers } = useLoaderData();
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate("..");
    }
  };
  const refresh = () => {
    navigate(".", { replace: true });
  };
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px] overflow-auto max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Edit Sink</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="information"
          onValueChange={(value) => {
            if (value === "images") navigate("images");
          }}
        >
          <TabsList>
            <TabsTrigger value="information">General</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
          <TabsContent value="information">
            <SinkInformation
              sinkData={sink}
              suppliers={suppliers}
              refresh={refresh}
            />
          </TabsContent>
          <TabsContent value="images">
            <Outlet />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
