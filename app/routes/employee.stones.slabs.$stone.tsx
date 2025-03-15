import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
  useNavigate,
  useNavigation,
} from "react-router";
import { useState } from "react";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { FormProvider, useForm, useFieldArray } from "react-hook-form";
import { FormField } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { SelectInput } from "~/components/molecules/SelectItem";

interface Slab {
  id: number;
  bundle: string;
  url: string | null;
  is_sold: boolean | number;
}

interface Sink {
  name: string;
}

interface SellSlabFormData {
  customer: string;
  sqft: string;
  sinks: { sinkName: string }[];
  extraSlabs: { slabId: string }[];
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
  const sinks = await selectMany<Sink>(db, "SELECT name FROM sinks");
  return { slabs, stone, sinks };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request);
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
  const formData = await request.formData();
  const _action = formData.get("_action");
  if (_action === "toggleSell") {
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
      return forceRedirectError(request.headers, "No slab found");
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
  return forceRedirectError(request.headers, "Unknown action");
}

export function SellSlab({
  open,
  onOpenChange,
  slabId,
  slabs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slabId: number | null;
  slabs: Slab[];
}) {
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const { sinks } = useLoaderData<typeof loader>();
  const filteredSlabs = slabId ? slabs.filter((s) => s.id !== slabId) : slabs;
  const form = useForm<SellSlabFormData>({
    defaultValues: {
      customer: "",
      sqft: "",
      sinks: [{ sinkName: "" }],
      extraSlabs: [],
    },
  });
  const {
    fields: sinkFields,
    append: appendSink,
    remove: removeSink,
  } = useFieldArray({
    control: form.control,
    name: "sinks",
  });
  const {
    fields: extraSlabFields,
    append: appendSlab,
    remove: removeSlab,
  } = useFieldArray({
    control: form.control,
    name: "extraSlabs",
  });
  const fullSubmit = useFullSubmit(form);
  const handleChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };
  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sell Slab {slabId ?? ""}</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="sellSlabForm" method="post" onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
            <input type="hidden" name="_action" value="completeSell" />
            <input type="hidden" name="slabId" value={slabId ?? ""} />
            <FormField
              control={form.control}
              name="customer"
              render={({ field }) => (
                <InputItem
                  name="Customer"
                  placeholder="Name of the customer"
                  field={field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="sqft"
              render={({ field }) => (
                <InputItem
                  name="Square Feet"
                  placeholder="Amount of Square Feet"
                  field={field}
                  type="number"
                  className="[appearance:textfield]"
                />
              )}
            />
            <div className="flex flex-col gap-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Sinks</h4>
                {sinkFields.map((f, index) => (
                  <div key={f.id} className="flex items-end gap-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`sinks.${index}.sinkName`}
                      render={({ field }) => (
                        <SelectInput
                          className="mb-0"
                          label=""
                          field={field}
                          placeholder="Choose sink"
                          options={sinks.map((s) => ({
                            label: s.name,
                            value: s.name,
                          }))}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      className="mb-2"
                      onClick={() => removeSink(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendSink({ sinkName: "" })}
                >
                  Add Sink
                </Button>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Additional Slabs</h4>
                {extraSlabFields.map((f, index) => (
                  <div key={f.id} className="flex items-center gap-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`extraSlabs.${index}.slabId`}
                      render={({ field }) => (
                        <SelectInput
                          className="mb-0"
                          label=""
                          field={field}
                          placeholder="Choose Slab"
                          options={filteredSlabs.map((s) => ({
                            label: s.bundle,
                            value: String(s.id),
                          }))}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      className="mb-2"
                      onClick={() => removeSlab(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendSlab({ slabId: "" })}
                >
                  Add Slab
                </Button>
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save changes
              </Button>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

export default function SlabsModal() {
  const { slabs, stone } = useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellSlabId, setSellSlabId] = useState<number | null>(null);
  function openSellDialogFor(slabId: number) {
    setSellSlabId(slabId);
    setSellDialogOpen(true);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) history.back();
      }}
    >
      <DialogContent className="p-5 bg-white rounded-md shadow-lg text-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-center">{stone.name}</h2>
        <div className="flex flex-col gap-4">
          {slabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            slabs.map((slab) => {
              const isSold = !!slab.is_sold;
              return (
                <div
                  key={slab.id}
                  className={`transition-colors duration-300 flex items-center gap-4 p-3 rounded-lg border border-gray-200 ${
                    isSold ? "bg-red-200" : "bg-white"
                  }`}
                >
                  <img
                    src={slab.url ?? "/placeholder.png"}
                    alt="Slab"
                    className="w-15 h-15 object-cover cursor-pointer rounded"
                    onClick={() => {
                      if (slab.url) {
                        setSelectedImage(slab.url);
                      }
                    }}
                  />
                  <span
                    className={`font-semibold ${
                      isSold ? "text-red-900" : "text-gray-800"
                    }`}
                  >
                    {slab.bundle}
                  </span>
                  {isSold ? (
                    <Form method="post" className="ml-auto">
                      <AuthenticityTokenInput />
                      <input type="hidden" name="_action" value="toggleSell" />
                      <input type="hidden" name="slabId" value={slab.id} />
                      <Button type="submit" className="px-4 py-2">
                        Unsell
                      </Button>
                    </Form>
                  ) : (
                    <Button
                      type="button"
                      className="ml-auto px-4 py-2"
                      onClick={() => openSellDialogFor(slab.id)}
                    >
                      Sell
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <Dialog
          open={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1">
            <DialogClose className="absolute top-4 right-4 rounded-sm opacity-70">
              <span className="sr-only">Close</span>
            </DialogClose>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Full size"
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
        <SellSlab
          open={sellDialogOpen}
          onOpenChange={(open) => {
            setSellDialogOpen(open);
            if (!open) {
              setSellSlabId(null);
            }
          }}
          slabId={sellSlabId}
          slabs={slabs}
        />
      </DialogContent>
    </Dialog>
  );
}
