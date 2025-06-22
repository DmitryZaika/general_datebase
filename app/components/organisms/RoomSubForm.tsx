
import { FormProvider, FormField, FormLabel } from "~/components/ui/form";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import {  UseFormReturn, useWatch } from "react-hook-form";

import { BASE_PRICES, CUSTOMER_ITEMS } from "~/utils/constants";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { TCustomerSchema } from "~/schemas/sales";
import { Switch } from "~/components/ui/switch";
import { SelectInputOther } from "~/components/molecules/SelectInputOther";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import clsx from "clsx";
import { Sink, Faucet } from "~/types";
import { roomPrice } from "~/utils/contracts";
import { DynamicAdditions } from "~/components/molecules/DynamicAdditions";
import { StoneSearch } from "./StoneSearch";
import { AddSlabDialog } from "./AddSlabDialog";
import { AddSinkDialog } from "./AddSinkDialog";
import { AddFaucetDialog } from "./AddFaucetDialog";
import { AddExtraDialog } from "./AddExtraDialog";
import { useQuery } from "@tanstack/react-query";
import { Stone } from "~/types";

const roomOptions = [
    { key: "Kitchen", value: "Kitchen" },
    { key: "Bathroom", value: "Bathroom" },
    { key: "Outdoor", value: "Outdoor" },
    { key: "Island", value: "Island" },
  ];
  
  const backsplashOptions = [
    { key: "No", value: "No" },
    { key: "4 inch", value: "4 inch" },
    { key: "Full Height", value: "Full Height" },
  ];
  
  const getOptions = (value: keyof typeof BASE_PRICES) => {
    return Object.keys(BASE_PRICES[value]).map((key) => ({
      key,
      value: cleanValue(key),
    }))
  }

  const cleanValue = (key: string) => {
    const text = key.charAt(0).toUpperCase() + key.slice(1);
    return text.replace("_", " ");
  }
  
  async function getSlabMap(
    slabIds: number[]
  ): Promise<
    Record<number, string>
  > {
    const response = await fetch(
      `/api/slabNames?ids=${slabIds.join(",")}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch slabs");
    }
    const data = await response.json();
    return data.slabNames.reduce((acc: Record<number, string>, slab: { id: number; bundle: string }) => {
      acc[slab.id] = slab.bundle;
      return acc;
    }, {});
  } 

  async function getStone(
    slabId: number
  ): Promise<
    {
      id: number;
      type: string;
      name: string;
    }
  > {
    const response = await fetch(
      `/api/stoneInfo/${slabId}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch stone");
    }
    const data = await response.json();
    return data
  } 



 export const RoomSubForm = ({
    form,
    index,
    sink_type,
    faucet_type,
  }: {
    form: UseFormReturn<TCustomerSchema>;
    index: number;
    sink_type: Sink[];
    faucet_type: Faucet[];
  }) => {
    const [linearFeet, setLinearFeet] = useState<number | null>(null);
    const roomValues = useWatch({
      control: form.control,
      name: `rooms.${index}`,
    });
  
    const totalRoomPrice = useMemo(() => {
      return roomPrice(roomValues, sink_type, faucet_type);
    }, [roomValues, sink_type, faucet_type]);
  
    const inputWidth = "w-[50%]";
    const [showAddSlabDialog, setShowAddSlabDialog] = useState(false);
    const [showAddSinkDialog, setShowAddSinkDialog] = useState(false);
    const [showAddFaucetDialog, setShowAddFaucetDialog] = useState(false);
    const [showAddExtraDialog, setShowAddExtraDialog] = useState(false);
    const [selectedExtraItems, setSelectedExtraItems] = useState<
      (keyof typeof CUSTOMER_ITEMS)[]
    >([]);
    const [stone, setStone] = useState<Stone | undefined>(undefined)
  
    const slabIds = form.getValues(`rooms.${index}.slabs`).map((slab) => slab.id)

   const { data: slabMap } = useQuery({
    queryKey: ["slabMap", slabIds],
    queryFn: () => getSlabMap(slabIds),
   })
   const { data: stoneData } = useQuery({
    queryKey: ["stone", slabIds[0]],
    queryFn: () => getStone(slabIds[0]),
   })

   useEffect(() => {
    if (stoneData) {
      setStone(stoneData)
    }
   }, [stoneData])
  
  
    /*fect(() => {
      if (index !== 0) {
        return
      }
      const currentSlabs = form.getValues(`rooms.${index}.slabs`) || [];
      const slabExists = currentSlabs.some(
        (slab) => slab.id === Number(slabId)
      );

      if (!slabExists) {
        const newSlab = {
          id: Number(slabId),
          is_full: false,
        };
        form.setValue(`rooms.${index}.slabs`, [...currentSlabs, newSlab]);
      }
    }, [index, form]);
    */
  
    useEffect(() => {
      if (stone?.type) {
        form.setValue(
          `rooms.${index}.ten_year_sealer`,
          stone?.type?.toLowerCase() === "quartz" ? false : true
        );
      }
    }, [stone?.type, index]);
  
    useEffect(() => {
      if (stone?.name) {
        fetch(`/api/stones/search?name=${encodeURIComponent(stone?.name)}`)
          .then((response) => response.json())
          .then((data) => {
            const foundStone = data.stones?.find(
              (s: any) => s.id === stone?.id
            );
            if (foundStone && foundStone.retail_price) {
              form.setValue(
                `rooms.${index}.retail_price`,
                foundStone.retail_price
              );
  
              const squareFeet =
                form.getValues(`rooms.${index}.square_feet`) || 0;
              if (squareFeet > 0) {
                const totalPrice = squareFeet * foundStone.retail_price;
                form.setValue(`rooms.${index}.total_price`, totalPrice);
              }
            }
          })
          .catch(console.error);
      }
    }, [index, stone?.id, stone?.name, form]);
  
    const handleSwitchSlab = (slabId: number, isFull: boolean) => {
      form.setValue(
        `rooms.${index}.slabs`,
        form
          .getValues(`rooms.${index}.slabs`)
          .map((slab) =>
            slab.id === slabId ? { ...slab, is_full: isFull } : slab
          )
      );
    };
  
    const handleRemoveSlab = (slabId: number) => {
      form.setValue(
        `rooms.${index}.slabs`,
        form
          .getValues(`rooms.${index}.slabs`)
          .filter((slab) => slab.id !== slabId)
      );
    };
  
    const handleRemoveSink = (sinkIndex: number) => {
      const currentSink = form.getValues(`rooms.${index}.sink_type`);
      currentSink.splice(sinkIndex, 1);
      form.setValue(`rooms.${index}.sink_type`, currentSink);
    };
  
    const handleRemoveFaucet = (faucetIndex: number) => {
      const currentFaucet = (form.getValues(
        `rooms.${index}.faucet_type` as any
      ) || []) as any[];
      currentFaucet.splice(faucetIndex, 1);
      (form.setValue as any)(`rooms.${index}.faucet_type`, currentFaucet);
    };
  
    const handleRemoveRoom = () => {
      const rooms = form.getValues("rooms");
      rooms.splice(index, 1);
      form.setValue("rooms", rooms);
    };
  
    const handleExtraChange = (value: string | number, target: keyof typeof BASE_PRICES) => {
      let price = BASE_PRICES[target]
      if (typeof price === "function") {
        price = price(value as unknown as number)
        form.setValue(`rooms.${index}.extras.${target}`, price);
        return
      }
      price = price[value]
      if (typeof price === "function") {
        const squareFeet = form.getValues(`rooms.${index}.square_feet`) || 0;
        price = price({ linearFeet: linearFeet || 0, squareFeet });
      }
      form.setValue(`rooms.${index}.extras.${target}`, price);
    }
  
    const handleRetailPriceChange = (price: number) => {
      const squareFeet = form.getValues(`rooms.${index}.square_feet`) || 0;
      const totalPrice = squareFeet * price;
      form.setValue(`rooms.${index}.total_price`, totalPrice);
    }
  
    const handleSquareFeetChange = (squareFeet: number) => {
      const tearOutValue = form.getValues(`rooms.${index}.tear_out`);
      handleExtraChange(tearOutValue, "tear_out_price");
      const retailPrice = form.getValues(`rooms.${index}.retail_price`) || 0;
      form.setValue(`rooms.${index}.total_price`, squareFeet * retailPrice);
    }
   
    useEffect(() => {
      if (form.getValues(`rooms.${index}.room`) === "bathroom") {
        form.setValue(`rooms.${index}.stove`, "N/A");
      }
    }, [form.getValues(`rooms.${index}.room`)]);
  
    useEffect(() => {
      handleExtraChange(form.watch(`rooms.${index}.edge`), "edge_price")
    }, [linearFeet])
  
    type ExtraItemsState = Record<keyof typeof CUSTOMER_ITEMS, any>;
  
    const [extraItems, setExtraItems] = useState<ExtraItemsState>({} as any);
  
    useEffect(() => {
      setExtraItems((prev) => {
        const updated: ExtraItemsState = { ...prev } as any;
  
        // Add new keys
        selectedExtraItems.forEach((key) => {
          if (!updated[key]) {
            // determine valueKey for defaults
            const getValueKey = (itemKey: keyof typeof CUSTOMER_ITEMS) => {
              switch (itemKey) {
                case "tripFee":
                  return "miles";
                case "mitter_edge_price":
                  return "amount";
                case "oversize_piece":
                  return "sqft";
                case "ten_year_sealer":
                  return "amount";
                default:
                  return "value";
              }
            };
            const valKey = getValueKey(key);
  
            if (key === "ten_year_sealer") {
              const sqft = form.getValues(`rooms.${index}.square_feet`) || 0;
              updated[key] = { [valKey]: sqft.toString(), price: 0 } as any;
            } else {
              updated[key] = { [valKey]: "", price: 0 } as any;
            }
          }
        });
  
        (Object.keys(updated) as (keyof typeof CUSTOMER_ITEMS)[]).forEach((k) => {
          if (!selectedExtraItems.includes(k)) {
            delete updated[k];
          }
        });
  
        return updated;
      });
    }, [selectedExtraItems]);
  
  
  
    return (
      <>
        <div className="h-[1px] bg-gray-200 w-full my-2"></div>
        <div className="flex items-center justify-between">
          <h2 className="mt-6 mb-2 font-semibold text-sm">Room {index + 1}</h2>{" "}
          {index !== 0 && (
            <Button
              className=" top-0 right-0"
              variant="ghost"
              size="sm"
              onClick={handleRemoveRoom}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <FormField
            control={form.control}
            name={`rooms.${index}.room`}
            render={({ field }) => (
              <SelectInputOther
                field={field}
                name="Room"
                className="mb-0"
                options={roomOptions}
              />
            )}
          />
  
          <StoneSearch
            stone={stone}
            setStone={setStone}
            onRetailPriceChange={(price) => {
              form.setValue(`rooms.${index}.retail_price`, price);
  
              // Recalculate total price
              const squareFeet =
                form.getValues(`rooms.${index}.square_feet`) || 0;
              const totalPrice = squareFeet * price;
              form.setValue(`rooms.${index}.total_price`, totalPrice);
            }}
          />
  
          <FormField
            control={form.control}
            name={`rooms.${index}.backsplash`}
            render={({ field }) => (
              <SelectInputOther
                field={field}
                name="Backsplash"
                className={`mb-0`}
                options={backsplashOptions}
              />
            )}
          />
        </div>
  
        <div className="border border-gray-200 rounded-md p-2 flex gap-2 mt-2">
          <FormField
            control={form.control}
            name={`rooms.${index}.square_feet`}
            render={({ field }) => (
              <InputItem
                name={"Square Feet"}
                placeholder={"Enter Sqft"}
                field={{
                  ...field,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    field.onChange(event);
                    handleSquareFeetChange(parseInt(event.target.value) || 0);
               
                  }
                }}
                formClassName={`mb-0 ${inputWidth}`}
              />
            )}
          />
  
          <FormField
            control={form.control}
            name={`rooms.${index}.retail_price`}
            render={({ field }) => (
              <InputItem
                name={"Retail Price"}
                placeholder={"Price per sqft"}
                field={{
                  ...field,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    field.onChange(event);
                    handleRetailPriceChange(parseInt(event.target.value) || 0);
                  }
                }}
                formClassName={`mb-0 ${inputWidth}`}
              />
            )}
          />
  
          <FormField
            control={form.control}
            name={`rooms.${index}.total_price`}
            render={({ field }) => (
              <InputItem
                name={"Total"}
                placeholder={"Total Price"}
                field={field}
                formClassName="mb-0"
                disabled={true}
              />
            )}
          />
        </div>
  
        <div className="flex flex-col gap-2 mt-2">
          <div className="border border-gray-200 rounded-md p-2 flex gap-2">
            <FormField
            control={form.control}
            name={`rooms.${index}.edge`}
            render={({ field }) => (
              <SelectInputOther
                field={{
                  ...field,
                  onChange: (value) => {
                    field.onChange(value);
                    handleExtraChange(value, "edge_price");
                    
                  }
                }}
                name="Edge"
                className={`mb-0 ${inputWidth}`}
                options={getOptions("edge_price")}
              />
            )}
          />
            <div
              className={clsx(`mb-0 ${inputWidth}`, {
                hidden: [
                  "eased",
                  "1/4_bevel",
                  "1/2_bevel",
                  "flat",
                  "Flat",
                ].includes(form.watch(`rooms.${index}.edge`)),
              })}
            >
              <FormLabel>Linear Feet</FormLabel>
              <Input
                id={`linear-feet-${index}`}
                placeholder="Enter Linear Feet"
                value={linearFeet?.toString() || ""}
                onChange={(e) => {
                  setLinearFeet(Number(e.target.value))
                 
                }}
              />
            </div>
  
            <FormField
              control={form.control}
              name={`rooms.${index}.extras.edge_price`}
              render={({ field }) => (
                <InputItem
                  name={"Edge Price"}
                  placeholder={"Enter Edge Price"}
                  field={field}
                  formClassName="mb-0"
                />
              )}
            />
          </div>
  
          <div className="border border-gray-200 rounded-md p-2 flex gap-2">
            <FormField
              control={form.control}
              name={`rooms.${index}.tear_out`}
              render={({ field }) => (
                <SelectInputOther
                  field={{
                    ...field,
                    onChange: (value) => {
                      field.onChange(value);
                      handleExtraChange(value, "tear_out_price");
                      
                    }
                  }}
                  name="Tear-Out"
                  className={`mb-0 ${inputWidth}`}
                  options={getOptions("tear_out_price")}
                />
              )}
            />
  
            <FormField
              control={form.control}
              name={`rooms.${index}.extras.tear_out_price`}
              render={({ field }) => (
                <InputItem
                  name={"Tear-Out Price"}
                  placeholder={"Enter Tear-Out Price"}
                  field={field}
                  formClassName="mb-0"
                />
              )}
            />
          </div>
  
          {form.watch(`rooms.${index}.room`) !== "bathroom" && (
            <>
              <div className="border border-gray-200 rounded-md p-2 flex gap-2">
                <FormField
                  control={form.control}
                  name={`rooms.${index}.stove`}
                  render={({ field }) => (
                    <SelectInputOther
                      field={{
                        ...field,
                        onChange: (value) => {
                          field.onChange(value);
                          handleExtraChange(value, "stove_price");
                         
                        }
                      }}
                      name="Stove"
                      className={`mb-0 ${inputWidth}`}
                      options={getOptions("stove_price")}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name={`rooms.${index}.extras.stove_price`}
                  render={({ field }) => (
                    <InputItem
                      name={"Stove Price"}
                      placeholder={"Enter Stove Price"}
                      field={field}
                      formClassName="mb-0"
                    />
                  )}
                />
              </div>
              <div className="border border-gray-200 rounded-md p-2 flex gap-2">
                <FormField
                  control={form.control}
                  name={`rooms.${index}.waterfall`}
                  render={({ field }) => (
                    <SelectInputOther
                      field={{
                        ...field,
                        onChange: (value) => {
                          field.onChange(value);
                          handleExtraChange(value, "waterfall_price");
                          
                        }
                      }}
                      name="Waterfall"
                      className={`mb-0 ${inputWidth}`}
                      options={getOptions("waterfall_price")}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name={`rooms.${index}.extras.waterfall_price`}
                  render={({ field }) => (
                    <InputItem
                      name={"Waterfall Price"}
                      placeholder={"Enter Waterfall Price"}
                      field={field}
                      formClassName="mb-0"
                    />
                  )}
                />
              </div>
            </>
          )}
  
          <div className="border border-gray-200 rounded-md p-2 flex gap-2">
            <FormField
              control={form.control}
              name={`rooms.${index}.corbels`}
              render={({ field }) => (
                <InputItem
                  name={"Corbels"}
                  placeholder={"Number of corbels"}
                  field={{
                    ...field,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(event);
                      handleExtraChange(parseInt(event.target.value) || 0, "corbels_price");
                      
                    }
                  }}
                  formClassName={`mb-0 ${inputWidth}`}
                />
              )}
            />
  
            <FormField
              control={form.control}
              name={`rooms.${index}.extras.corbels_price`}
              render={({ field }) => (
                <InputItem
                  name={"Corbels Price"}
                  placeholder={"Enter Corbels Price"}
                  field={field}
                  formClassName="mb-0"
                />
              )}
            />
          </div>
  
          <div className="border border-gray-200 rounded-md p-2 flex gap-2">
            <FormField
              control={form.control}
              name={`rooms.${index}.seam`}
              render={({ field }) => (
                <SelectInputOther
                  field={{
                    ...field,
                    onChange: (value) => {
                      field.onChange(value);
                      handleExtraChange(value, "seam_price");
                      
                    }
                  }}
                  name="Seam"
                  className={`mb-0 ${inputWidth}`}
                  options={getOptions("seam_price")}
                />
              )}
            />
  
            <FormField
              control={form.control}
              name={`rooms.${index}.extras.seam_price`}
              render={({ field }) => (
                <InputItem
                  name={"Seam Price"}
                  placeholder={"Enter Seam Price"}
                  field={field}
                  formClassName="mb-0"
                />
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2 mt-4"></div>
          <div className="flex items-center space-x-2 mt-4">
            <Button
              type="button"
              variant="blue"
              size="sm"
              onClick={() => setShowAddExtraDialog(true)}
            >
              <Plus className="h-3 w-3" /> Add Extra Item
            </Button>
          </div>
        </div>
  
        <DynamicAdditions
          items={extraItems}
          onUpdate={(updated) => {
            setExtraItems(updated as any);
            const currentExtras = form.getValues(`rooms.${index}.extras`) || {};
            form.setValue(
              `rooms.${index}.extras`,
              { ...currentExtras, ...updated } as any,
              {
                shouldDirty: true,
                shouldValidate: true,
              }
            );
          }}
          onRemove={(key) => {
            setExtraItems((prev) => {
              const copy = { ...prev } as any;
              delete copy[key];
              return copy;
            });
            const currentExtras = form.getValues(`rooms.${index}.extras`) || {};
            delete currentExtras[key];
            form.setValue(`rooms.${index}.extras`, currentExtras, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setSelectedExtraItems((prev) => prev.filter((k) => k !== key));
          }}
        />
  
        <Tabs defaultValue="slabs" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="slabs">Slabs</TabsTrigger>
            <TabsTrigger value="sinks">Sinks</TabsTrigger>
            <TabsTrigger value="faucets">Faucets</TabsTrigger>
          </TabsList>
  
          <TabsContent value="slabs" className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSlabDialog(true)}
              >
                Add Slab
              </Button>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs text-gray-600">Slabs:</h2>
              {form.watch(`rooms.${index}.slabs`).map((slab, slabIndex) => (
                <div
                  key={slab.id}
                  className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={slab.is_full}
                      onCheckedChange={(checked) =>
                        handleSwitchSlab(slab.id, checked)
                      }
                      id={`additional_slab_${slab.id}`}
                      label="Full Slab Sold"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`px-2 py-1 rounded-md text-sm ${
                        slab.is_full
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      Bundle {slabMap?.[slab.id]}
                      {slab.is_full ? "(Full)" : "(Partial)"}
                    </div>
                    {form.watch(`rooms.${index}.slabs`).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveSlab(slab.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
  
          <TabsContent value="sinks" className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSinkDialog(true)}
              >
                Add Sink
              </Button>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs text-gray-600">Sinks:</h2>
              {form.watch(`rooms.${index}.sink_type`).map((sink, sinkIndex) => (
                <div
                  key={`${index}-${sinkIndex}-${sink.id}`}
                  className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium">
                      {sink_type.find((s) => s.id === sink.id)?.type} -{" "}
                      {sink_type.find((s) => s.id === sink.id)?.name}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="px-2 py-1 rounded-md text-sm bg-blue-100 text-blue-800">
                      ${sink_type.find((s) => s.id === sink.id)?.retail_price}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveSink(sinkIndex)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <input type="hidden" name="sink_ids[]" value={sink.id} />
                </div>
              ))}
            </div>
          </TabsContent>
  
          <TabsContent value="faucets" className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddFaucetDialog(true)}
              >
                Add Faucet
              </Button>
            </div>
            <div className="space-y-2">
              <h2 className="text-xs text-gray-600">Faucets:</h2>
              {(form.watch(`rooms.${index}.faucet_type` as any) || []).map(
                (faucet: any, faucetIndex: number) => (
                  <div
                    key={`${index}-${faucetIndex}-${faucet.id}`}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium">
                        {faucet_type.find((f) => f.id === faucet.id)?.type} -{" "}
                        {faucet_type.find((f) => f.id === faucet.id)?.name}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-md text-sm bg-green-100 text-green-800">
                        $
                        {
                          faucet_type.find((f) => f.id === faucet.id)
                            ?.retail_price
                        }
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveFaucet(faucetIndex)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <input type="hidden" name="faucet_ids[]" value={faucet.id} />
                  </div>
                )
              )}
            </div>
          </TabsContent>
        </Tabs>
  
        {stone?.id && (
          <>
          {showAddSlabDialog && (
            <AddSlabDialog
              show={true}
              setShow={setShowAddSlabDialog}
              roomIndex={index}
              form={form}
              stoneId={stone?.id}
              
            />
            )}
            <AddSinkDialog
              show={showAddSinkDialog}
              setShow={setShowAddSinkDialog}
              roomIndex={index}
              form={form}
              sink_type={sink_type}
            />
            <AddFaucetDialog
              show={showAddFaucetDialog}
              setShow={setShowAddFaucetDialog}
              roomIndex={index}
              form={form}
              faucet_type={faucet_type}
            />
          </>
        )}
        <AddExtraDialog
          show={showAddExtraDialog}
          setShow={setShowAddExtraDialog}
          currentItems={selectedExtraItems}
          onSave={(items) =>
            setSelectedExtraItems(items as (keyof typeof CUSTOMER_ITEMS)[])
          }
        />
        <div className="text-right font-semibold text-lg my-4">
          Total Room Price: ${totalRoomPrice.toFixed(2)}
        </div>
      </>
    );
  };