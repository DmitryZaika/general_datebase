import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
  useNavigation,
} from "react-router";
import { useState } from "react";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { selectMany, selectId } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "~/components/ui/dialog";
import { useState, useEffect } from "react";
import { Input } from "~/components/ui/input";

interface Slab {
  id: number;
  bundle: string;
  url: string | null;
  is_sold: boolean | number;
  width: number;
  length: number;
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
  const stone = await selectId<{ id: number; name: string; url: string }>(
    db,
    "SELECT id, name, url FROM stones WHERE id = ?",
    stoneId
  );
  if (!stone) {
    return forceRedirectError(request.headers, "No stone found for given ID");
  }
  const slabs = await selectMany<Slab>(
    db,
    "SELECT id, bundle, url, is_sold, width, length FROM slab_inventory WHERE stone_id = ?",
    [stoneId]
  );
  const sinks = await selectMany<Sink>(db, "SELECT name FROM sinks");
  return { slabs, stone, sinks };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.stone) {
    return forceRedirectError(request.headers, "No stone id provided");
  }
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  if (intent === "updateSize") {
    const slabId = formData.get("slabId");
    const width = formData.get("width");
    const length = formData.get("length");
    
    if (!slabId || !width || !length) {
      return forceRedirectError(request.headers, "Missing required fields");
    }

    try {
      await db.execute(
        "UPDATE slab_inventory SET width = ?, length = ? WHERE id = ?",
        [parseInt(width.toString()), parseInt(length.toString()), parseInt(slabId.toString())]
      );

      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Success", "Slab size updated"));
      return redirect(request.url, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    } catch (error) {
      console.error("Error updating slab size:", error);
      const session = await getSession(request.headers.get("Cookie"));
      session.flash("message", toastData("Error", "Failed to update slab size"));
      return redirect(request.url, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
  }

  const slabId = formData.get("slabId");
  if (!slabId) {
    return forceRedirectError(request.headers, "No slabId provided");
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
  const [editingSlab, setEditingSlab] = useState<number | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (navigation.state === "idle" && editingSlab !== null) {
      setEditingSlab(null);
    }
  }, [navigation.state]);

  const handleEditClick = (slabId: number) => {
    console.log('Setting editing slab:', slabId);
    setEditingSlab(slabId);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) history.back();
      }}
    >
      <DialogContent className="p-5 bg-white rounded-md p-0 sm:p-5 shadow-lg text-gray-800 overflow-y-auto max-h-[95vh]">
        <DialogTitle>Slabs for {stone.name}</DialogTitle>

        <div className="flex flex-col gap-4">
          {slabs.length === 0 ? (
            <p className="text-center text-gray-500">No Slabs available</p>
          ) : (
            slabs.map((slab) => {
              const isSold = !!slab.is_sold;
              const isEditing = editingSlab === slab.id;

              return (
                <div
                  key={slab.id}
                  className={`transition-colors duration-300 flex items-center gap-4 p-3 rounded-lg border border-gray-200 ${
                    isSold ? "bg-red-200" : "bg-white"
                  }`}
                >
                  <img
                    src={
                      slab.url === "undefined" || slab.url === null
                        ? stone.url
                        : slab.url
                    }
                    alt="Slab"
                    className="w-7 h-7 sm:w-15 sm:h-15 object-cover cursor-pointer rounded"
                    onClick={() => {
                      if (slab.url) {
                        setSelectedImage(slab.url);
                      }
                    }}
                  />
                  
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      isSold ? "text-red-900" : "text-gray-800"
                    }`}
                  >
                    {slab.bundle}
                  </span>

                  <div className="flex items-center gap-2 w-full">
                    {isEditing ? (
                      <Form method="post" className="flex items-center gap-2 w-full">
                        <AuthenticityTokenInput />
                        <input type="hidden" name="intent" value="updateSize" />
                        <input type="hidden" name="slabId" value={slab.id} />
                        <Input
                          type="number"
                          name="length"
                          defaultValue={slab.length}
                          className="w-12 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          inputMode="numeric"
                        />
                        <span>x</span>
                        <Input
                          type="number"
                          name="width"
                          defaultValue={slab.width}
                          className="w-12 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          inputMode="numeric"
                        />
                        <Button type="submit" size="sm" className="ml-auto">Save</Button>
                      </Form>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleEditClick(slab.id)}
                        className="text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        {slab.length} x {slab.width}
                      </button>
                    )}
                  </div>

                  {!isEditing && (
                    <Form method="post" className="ml-auto">
                      <AuthenticityTokenInput />
                      <input type="hidden" name="slabId" value={slab.id} />
                      <Button type="submit" className="px-4 py-2">
                        {isSold ? "Unsell" : "Sell"}
                      </Button>
                    </Form>
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
                src={selectedImage === "undefined" ? stone.url : selectedImage}
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
