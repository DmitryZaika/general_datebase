import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  useParams,
  useLoaderData,
  useLocation,
} from "react-router";
import { Form, useNavigate } from "react-router";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { InputItem } from "~/components/molecules/InputItem";
import { Button } from "~/components/ui/button";
import { useForm, UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { SelectInput } from "~/components/molecules/SelectItem";
import { selectMany } from "~/utils/queryHelpers";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { coerceNumberRequired, StringOrNumber } from "~/schemas/general";
import { Switch } from "~/components/ui/switch";
import { SelectInputOther } from "~/components/molecules/SelectInputOther";
import { AddressInput } from "~/components/organisms/AddressInput";
import { useQuery } from "@tanstack/react-query";
import { StoneSearchResult } from "~/types";

interface Sink {
  id: number;
  name: string;
  type: string;
}

interface RoomSlab {
  id: number;
  bundle: string;
  is_full_slab: boolean;
}

const roomOptions = [
  { key: "Kitchen", value: "Kitchen" },
  { key: "Bathroom", value: "Bathroom" },
  { key: "Outdoor", value: "Outdoor" },
  { key: "Island", value: "Island" },
];

const edgeOptions = [
  { key: "Flat", value: "Flat" },
  { key: "Eased", value: "Eased" },
  { key: "1/4 Bevel", value: "1/4 Bevel" },
  { key: "1/2 Bevel", value: "1/2 Bevel" },
  { key: "Bullnose", value: "Bullnose" },
  { key: "Ogee", value: "Ogee" },
];

const backsplashOptions = [
  { key: "No", value: "No" },
  { key: "4 inch", value: "4 inch" },
  { key: "Full Height", value: "Full Height" },
];

const tearOutOptions = [
  { key: "No", value: "No" },
  { key: "Laminate", value: "Laminate" },
  { key: "Stone", value: "Stone" },
];

const stoveOptions = [
  { key: "F/S", value: "F/S" },
  { key: "S/I", value: "S/I" },
  { key: "C/T", value: "C/T" },
  { key: "Grill", value: "Grill" },
];

const waterfallOptions = [
  { key: "No", value: "No" },
  { key: "Yes", value: "Yes" },
];

const seamOptions = [
  { key: "Standard", value: "Standard" },
  { key: "Phantom", value: "Phantom" },
  { key: "Extended", value: "Extended" },
  { key: "No seam", value: "No seam" },
  { key: "European", value: "European" },
  { key: "N/A", value: "N/A" },
];

const slabOptionsSchema = z.object({
  id: z.coerce.number(),
  is_full: z.boolean(),
});

const roomSchema = z.object({
  room: z.string().default("Kitchen"),
  sinks: z.array(z.coerce.number()).default([]),
  edge: z.string().default("Flat"),
  backsplash: z.string().default("No"),
  total_square_feet: z.number().default(0),
  tear_out: z.string().default("No"),
  stove: z.string().default("F/S"),
  waterfall: z.string().default("No"),
  corbels: z.number().default(0),
  seam: z.string().default("Standard"),
  ten_year_sealer: z.boolean().default(false),
  slabs: z.array(slabOptionsSchema).default([]),
});

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customer_id: z.coerce.number().optional(),
  billing_address: z.string().min(10, "Billing address is required"),
  project_address: z.string().min(10, "Project address is required"),
  same_address: z.boolean().default(true),
  phone: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, "Required format: 317-316-1456"),
  email: z.string().email("Please enter a valid email"),
  price: coerceNumberRequired("Please Enter Price"),
  notes_to_sale: StringOrNumber,

  rooms: z.array(roomSchema).optional(),
});

const seamNameToCode: Record<string, string> = {
  Phantom: "SPH",
  Standard: "STD",
  Extended: "EXT",
  "No seam": "NONE!",
  European: "EU",
  "N/A": "N/A",
};

type Room = z.infer<typeof roomSchema>;

type FormData = z.infer<typeof customerSchema>;

const resolver = zodResolver(customerSchema);

export async function action({ request, params }: ActionFunctionArgs) {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  try {
    await csrf.validate(request);
  } catch (error) {
    return { error: "Invalid CSRF token" };
  }
  const { errors, data, receivedValues } = await getValidatedFormData<FormData>(
    request,
    resolver
  );
  if (errors) {
    return { errors, receivedValues };
  }
  // Преобразуем значение seam, если оно есть и соответствует одному из полных названий
  if (data.seam && typeof data.seam === "string" && seamNameToCode[data.seam]) {
    data.seam = seamNameToCode[data.seam];
  }

  const slabId = params.slab;
  if (!slabId) {
    return { error: "Slab ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  // Get additional slab IDs from already parsed data and fallback to URL params if needed
  let slabIds: number[] = [];

  // Parse additional slab IDs from the already parsed data

  // If no additional slabs found in parsed data, try to get from URL search params
  if (slabIds.length === 0) {
    const urlAdditionalSlabs = url.searchParams.getAll("slab_ids");
    if (urlAdditionalSlabs.length > 0) {
      slabIds = urlAdditionalSlabs
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));
    }
  }

  try {
    const [slabDimensions] = await db.execute<RowDataPacket[]>(
      `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
      [slabId]
    );

    if (!slabDimensions || slabDimensions.length === 0) {
      throw new Error("Slab not found");
    }

    let customerId: number;

    if (data.customer_id) {
      customerId = data.customer_id;

      const [customerVerify] = await db.execute<RowDataPacket[]>(
        `SELECT id, name, address, phone, email FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, user.company_id]
      );

      if (!customerVerify || customerVerify.length === 0) {
        throw new Error("Customer not found");
      }

      // Check if we need to update customer information (address, phone, email)
      const updateFields = [];
      const updateValues = [];

      // If we have a billing address and customer doesn't have an address
      if (
        data.billing_address &&
        (!customerVerify[0].address || customerVerify[0].address === "")
      ) {
        updateFields.push("address = ?");
        updateValues.push(data.billing_address);
      }

      if (
        data.phone &&
        (!customerVerify[0].phone || customerVerify[0].phone === "")
      ) {
        updateFields.push("phone = ?");
        updateValues.push(data.phone);
      }

      // If we have an email and customer doesn't have one
      if (
        data.email &&
        (!customerVerify[0].email || customerVerify[0].email === "")
      ) {
        updateFields.push("email = ?");
        updateValues.push(data.email);
      }

      // If we have fields to update, run the update query
      if (updateFields.length > 0) {
        await db.execute(
          `UPDATE customers SET ${updateFields.join(
            ", "
          )} WHERE id = ? AND company_id = ?`,
          [...updateValues, customerId, user.company_id]
        );
      }

      // If the customer already has an address but the form submission doesn't,
      // use the existing address
      if (!data.billing_address && customerVerify[0].address) {
        data.billing_address = customerVerify[0].address;
      }

      // Same for project address - if using same address
      if (data.same_address && data.billing_address) {
        data.project_address = data.billing_address;
      }
    } else {
      const [customerResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO customers (name, company_id, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
        [
          data.name,
          user.company_id,
          data.phone || null,
          data.email || null,
          data.billing_address || null,
        ]
      );
      customerId = customerResult.insertId;
    }

    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price, project_address) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?, ?)`,
      [
        customerId,
        user.id,
        user.company_id,
        data.notes_to_sale || null,
        data.total_square_feet || 0,
        data.price || 0,
        data.project_address || null,
      ]
    );

    const saleId = salesResult.insertId;

    if (data.sink_type_id) {
      const sinkTypeId = parseInt(data.sink_type_id as string, 10);

      if (!isNaN(sinkTypeId)) {
        const [sinkTypeResult] = await db.execute<RowDataPacket[]>(
          `SELECT retail_price FROM sink_type WHERE id = ?`,
          [sinkTypeId]
        );

        let price = 0;
        if (sinkTypeResult && sinkTypeResult.length > 0) {
          price = sinkTypeResult[0].retail_price || 0;
        }

        const [availableSinks] = await db.execute<RowDataPacket[]>(
          `SELECT id FROM sinks 
           WHERE sink_type_id = ? 
           AND sale_id IS NULL 
           AND is_deleted = 0 
           LIMIT 1`,
          [sinkTypeId]
        );

        if (availableSinks && availableSinks.length > 0) {
          const sinkId = availableSinks[0].id;

          await db.execute(
            `UPDATE sinks SET sale_id = ?, is_deleted = 1, price = ? WHERE id = ?`,
            [saleId, price, sinkId]
          );
        }
      }
    }

    if (data.is_full_slab_sold) {
      await db.execute(
        `UPDATE slab_inventory SET sale_id = ?, seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, 
        stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
        [
          saleId,
          data.seam || "Standard",
          data.edge || "Flat",
          data.room || "Kitchen",
          data.backsplash || "No",
          data.tear_out || "No",
          data.stove || "F/S",
          data.ten_year_sealer || false,
          data.waterfall || "No",
          data.corbels || 0,
          slabId,
        ]
      );
    } else {
      await db.execute<ResultSetHeader>(
        `INSERT INTO slab_inventory 
         (stone_id, bundle, length, width, url, parent_id, seam, edge, room, backsplash, tear_out, 
          stove, ten_year_sealer, waterfall, corbels) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slabDimensions[0].stone_id,
          slabDimensions[0].bundle,
          slabDimensions[0].length,
          slabDimensions[0].width,
          slabDimensions[0].url,
          slabId,
          data.seam || "Standard",
          data.edge || "Flat",
          data.room || "Kitchen",
          data.backsplash || "No",
          data.tear_out || "No",
          data.stove || "F/S",
          data.ten_year_sealer || false,
          data.waterfall || "No",
          data.corbels || 0,
        ]
      );

      await db.execute(`UPDATE slab_inventory SET sale_id = ? WHERE id = ?`, [
        saleId,
        slabId,
      ]);

      const session = await getSession(request.headers.get("Cookie"));
      session.flash(
        "message",
        toastData("Info", "Created a copy of partially sold slab")
      );
      return redirect(`..${searchString}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }

    // Handle additional rooms
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        // Get slab details if a slab was selected
        let slabId = null;
        let bundle = null;
        let stoneId = slabDimensions[0].stone_id;

        if (room.slab_number) {
          const bundleMatch = room.slab_number.match(/Bundle (\w+)/);
          if (bundleMatch && bundleMatch[1]) {
            bundle = bundleMatch[1];

            // Find the slab ID from available slabs with matching bundle
            const [slabResult] = await db.execute<RowDataPacket[]>(
              `SELECT id FROM slab_inventory 
                WHERE bundle = ? AND stone_id = ? AND sale_id IS NULL 
                LIMIT 1`,
              [bundle, stoneId]
            );

            if (slabResult && slabResult.length > 0) {
              slabId = slabResult[0].id;
            }
          }
        }

        // Insert the additional room
        await db.execute<ResultSetHeader>(
          `INSERT INTO slab_inventory 
           (stone_id, bundle, sale_id, seam, edge, room, backsplash, tear_out, 
            stove, ten_year_sealer, waterfall, corbels) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stoneId,
            bundle,
            saleId,
            room.seam || "Standard",
            room.edge || "Flat",
            room.room || "Kitchen",
            room.backsplash || "No",
            room.tear_out || "No",
            room.room !== "Bathroom" ? room.stove || "F/S" : null,
            room.ten_year_sealer || false,
            room.waterfall || "No",
            room.corbels || 0,
          ]
        );
      }
    }

    // Handle additional slab if selected

    for (const slabId of slabIds) {
      if (slabId) {
        await db.execute(
          `UPDATE slab_inventory SET sale_id = ?, seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, 
            stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
          [
            saleId,
            data.seam || "Standard",
            data.edge || "Flat",
            data.room || "Kitchen",
            data.backsplash || "No",
            data.tear_out || "No",
            data.stove || "F/S",
            data.ten_year_sealer || false,
            data.waterfall || "No",
            data.corbels || 0,
            slabId,
          ]
        );
      }
    }
  } catch (error) {
    console.error("Error during sale process: ", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to process sale"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sale completed successfully"));
  return redirect(`..${searchString}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);
    const slabId = params.slab;

    if (!slabId) {
      throw new Error("Slab ID is missing");
    }

    // Получаем информацию о типе камня для этой плиты
    const stoneInfo = await selectMany<{
      id: number;
      type: string;
      name: string;
    }>(
      db,
      `SELECT stones.id, stones.type, stones.name
       FROM stones 
       JOIN slab_inventory ON slab_inventory.stone_id = stones.id 
       WHERE slab_inventory.id = ?`,
      [slabId]
    );

    const stoneType = stoneInfo.length > 0 ? stoneInfo[0].type : null;
    const stoneName = stoneInfo.length > 0 ? stoneInfo[0].name : null;

    // Get slab details
    const slabDetails = await selectMany<{
      id: number;
      bundle: string;
      stone_id: number;
    }>(
      db,
      `SELECT id, bundle, stone_id 
       FROM slab_inventory 
       WHERE id = ?`,
      [slabId]
    );

    const bundle = slabDetails.length > 0 ? slabDetails[0].bundle : null;

    const sinks = await selectMany<Sink>(
      db,
      `SELECT st.id, st.name, st.type 
       FROM sink_type st
       WHERE st.company_id = ?
       AND EXISTS (
         SELECT 1 
         FROM sinks s 
         WHERE s.sink_type_id = st.id
         AND s.sale_id IS NULL 
         AND s.is_deleted = 0
       )
       ORDER BY st.name ASC`,
      [user.company_id]
    );

    const allSales = await selectMany<{
      id: number;
      customer_name: string;
      sale_date: string;
      notes: string | null;
      square_feet: number;
    }>(
      db,
      `SELECT s.id, c.name as customer_name, s.sale_date, s.notes, s.square_feet
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.company_id = ? AND s.cancelled_date IS NULL
       ORDER BY s.sale_date DESC`,
      [user.company_id]
    );

    const customers = await selectMany<{
      id: number;
      name: string;
    }>(
      db,
      `SELECT id, name FROM customers 
       WHERE company_id = ? 
       ORDER BY id DESC
       LIMIT 100`,
      [user.company_id]
    );

    return {
      user,
      sinks,
      allSales,
      customers,
      stoneType,
      stoneName,
      bundle,
      slabId,
    };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

async function getSlabs(
  stoneId: number,
  slabId: number
): Promise<
  {
    id: number;
    bundle: string;
  }[]
> {
  const response = await fetch(
    `/api/stones/${stoneId}/slabs?exclude=${slabId}&available=true`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch slabs");
  }
  const data = await response.json();
  return data.slabs;
}

const AddSlabDialog = ({
  show,
  setShow,
  form,
  stoneId,
  roomIndex,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<FormData>;
  stoneId: number;
  roomIndex: number;
}) => {
  const params = useParams();
  const currentSlabId = Number(params.slab);
  const [selectedSlabId, setSelectedSlabId] = useState<string>("");

  const { data: availableSlabs = [] } = useQuery({
    queryKey: ["slabs", stoneId, currentSlabId],
    queryFn: () => getSlabs(stoneId, currentSlabId),
    enabled: !!stoneId && !!currentSlabId && show,
  });

  const currentSlabs = form.watch(`rooms.${roomIndex}.slabs`) || [];
  const addedSlabIds = currentSlabs.map((slab) => slab.id);

  const filteredSlabs = availableSlabs.filter(
    (slab) => !addedSlabIds.includes(slab.id)
  );

  useEffect(() => {
    if (filteredSlabs.length > 0 && show) {
      form.setValue("selectedSlabId", String(filteredSlabs[0].id));
    }
  }, [filteredSlabs, show, form]);

  useEffect(() => {
    if (!show) {
      form.setValue("selectedSlabId", "");
    }
  }, [show, form]);

  const handleAddSlab = () => {
    const selectedValue = form.getValues("selectedSlabId");
    if (!selectedValue) {
      alert("Please select a slab first");
      return;
    }

    const currentSlabsPath = `rooms.${roomIndex}.slabs`;
    const currentSlabs = form.getValues(currentSlabsPath) || [];
    const alreadyExists = currentSlabs.some(
      (slab) => slab.id === Number(selectedValue)
    );

    if (alreadyExists) {
      alert("This slab is already added to this room");
      return;
    }

    const newSlab = {
      id: Number(selectedValue),
      is_full: false,
    };

    form.setValue(currentSlabsPath, [...currentSlabs, newSlab]);

    form.setValue("selectedSlabId", "");
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Slab</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <div className="space-y-4">
            {filteredSlabs.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No available slabs found for this stone
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name={`selectedSlabId`}
                  defaultValue={
                    availableSlabs.length > 0
                      ? String(availableSlabs[0].id)
                      : ""
                  }
                  render={({ field }) => (
                    <SelectInput
                      field={field}
                      placeholder="Select a slab"
                      name="Additional Slab"
                      className="mb-0"
                      options={filteredSlabs.map((slab) => ({
                        key: String(slab.id),
                        value: `Bundle ${slab.bundle}`,
                      }))}
                    />
                  )}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSlab}
              disabled={filteredSlabs.length === 0}
            >
              Add Slab
            </Button>
          </DialogFooter>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};

const StoneTypeDisplay = ({ stoneType }: { stoneType: string | null }) => {
  if (!stoneType) return null;

  return (
    <>
      <span
        className={`ml-2 text-xs px-2 py-1 rounded ${
          stoneType.toLowerCase() === "quartz"
            ? "bg-red-100 text-red-800"
            : "bg-green-100 text-green-800"
        }`}
      >
        {stoneType.charAt(0).toUpperCase() + stoneType.slice(1)}
      </span>
    </>
  );
};

const fetchAvailableStones = async (query: string = "") => {
  const response = await fetch(
    `/api/stones/search?name=${encodeURIComponent(query)}&unsold_only=true`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch slabs");
  }
  const data = await response.json();
  const stones: StoneSearchResult[] = data.stones || [];

  const typeMap: Record<string, string> = {};
  stones.forEach((stone) => {
    typeMap[stone.name] = stone.type;
  });

  return { stoneType: typeMap, stoneSearchResults: stones };
};

const StoneSearch = ({
  setStoneId,
}: {
  setStoneId: (stoneId: number) => void;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [show, setShow] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["availableStones", searchValue],
    queryFn: () => fetchAvailableStones(searchValue),
    enabled: !!searchValue,
  });

  const handleStoneSelect = (stone: { id: number; name: string }) => {
    setStoneId(stone.id);
    setSearchValue(stone.name);
    setShow(false);
  };

  const handleValueChange = (value: string) => {
    setSearchValue(value);
    if (show === false) {
      setShow(true);
    } 
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Color</label>
      <div className="relative">
        <Input
          placeholder="Search stone colors..."
          value={searchValue}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full"
        />
        {isLoading && (
          <div className="absolute right-8 top-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Stone search results dropdown */}
      {show && (data?.stoneSearchResults?.length ?? 0) > 0 && (
        <div className=" -mt-2 absolute z-10 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg w-3/7">
          <ul className="py-1 divide-y divide-gray-200">
            {data?.stoneSearchResults?.map((stone) => (
              <li
                key={stone.id}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleStoneSelect(stone)}
              >
                {stone.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const RoomSubForm = ({
  form,
  index,
  sinks,
  stoneType,
}: {
  form: UseFormReturn<FormData>;
  index: number;
  sinks: Sink[];
  stoneType: string | null;
}) => {
  const [showAddSlabDialog, setShowAddSlabDialog] = useState(false);
  const [stoneId, setStoneId] = useState<number | null>(null);
  const { slabId, bundle } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (slabId && bundle && index === 0) {
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
    }
  }, [slabId, bundle, index, form]);

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

  return (
    <>
      <div className="mt-6 mb-2 font-semibold text-sm">First Room</div>
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

        <StoneSearch setStoneId={setStoneId} />

        {/* <FormField
          control={form.control}
          name={`rooms.${index}.sink_type_id`}
          render={({ field }) => {
            return (
              <SelectInput
                field={field}
                name="Sink"
                className="mb-0"
                placeholder="Select a Sink"
                options={sinks.map((sink) => {
                  return {
                    key: String(sink.id),
                    value: sink.name,
                  };
                })}
              />
            );
          }}
        /> */}

        <FormField
          control={form.control}
          name={`rooms.${index}.edge`}
          render={({ field }) => (
            <SelectInputOther
              field={field}
              name="Edge"
              className="mb-0"
              options={edgeOptions}
            />
          )}
        />

        <FormField
          control={form.control}
          name={`rooms.${index}.backsplash`}
          render={({ field }) => (
            <SelectInputOther
              field={field}
              name="Backsplash"
              className="mb-0"
              options={backsplashOptions}
            />
          )}
        />

        <FormField
          control={form.control}
          name={`rooms.${index}.total_square_feet`}
          render={({ field }) => (
            <InputItem
              name={"Square Feet"}
              placeholder={"Enter Sqft"}
              field={field}
              formClassName="mb-0"
            />
          )}
        />

        <FormField
          control={form.control}
          name={`rooms.${index}.tear_out`}
          render={({ field }) => (
            <SelectInputOther
              field={field}
              name="Tear-Out"
              className="mb-0"
              options={tearOutOptions}
            />
          )}
        />

        {form.watch(`rooms.${index}.room`) !== "bathroom" && (
          <>
            <FormField
              control={form.control}
              name={`rooms.${index}.stove`}
              render={({ field }) => (
                <SelectInputOther
                  field={field}
                  name="Stove"
                  className="mb-0"
                  options={stoveOptions}
                  defaultValue="F/S"
                />
              )}
            />
            <FormField
              control={form.control}
              name={`rooms.${index}.waterfall`}
              render={({ field }) => (
                <SelectInputOther
                  field={field}
                  name="Waterfall"
                  className="mb-0"
                  options={waterfallOptions}
                />
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name={`rooms.${index}.corbels`}
          render={({ field }) => (
            <InputItem
              name={"Corbels"}
              placeholder={"Number of corbels"}
              field={field}
              formClassName="mb-0"
            />
          )}
        />

        <FormField
          control={form.control}
          name={`rooms.${index}.seam`}
          render={({ field }) => (
            <SelectInputOther
              field={field}
              name="Seam"
              className="mb-0"
              options={seamOptions}
            />
          )}
        />
      </div>

      <div className="flex items-center space-x-2 mt-4">
        <FormField
          control={form.control}
          name={`rooms.${index}.ten_year_sealer`}
          render={({ field }) => (
            <>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                id="ten_year_sealer"
                disabled={Boolean(stoneType?.toLowerCase() === "quartz")}
                label="10-Year Sealer"
              />
              <StoneTypeDisplay stoneType={stoneType} />
            </>
          )}
        />
      </div>

      <div className="flex items-center space-x-2 mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddSlabDialog(true)}
        >
          Add Slab
        </Button>
      </div>

      <div className="mt-2 space-y-2">
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
                Bundle {slab.id}
                {slab.is_full ? "(Full)" : "(Partial)"}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleRemoveSlab(slab.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <input type="hidden" name="slab_ids[]" value={slab.id} />
            <input
              type="hidden"
              name={`slab_${slab.id}_is_full`}
              value={slab.is_full ? "1" : "0"}
            />
          </div>
        ))}

        <AddSlabDialog
          show={showAddSlabDialog}
          setShow={setShowAddSlabDialog}
          roomIndex={index}
          form={form}
          stoneId={stoneId}
        />
      </div>
    </>
  );
};

export default function SlabSell() {
  const { sinks, allSales, customers, stoneType, stoneName, bundle, slabId } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const location = useLocation();
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<
    {
      id: number;
      name: string;
      address: string | null;
      phone: string | null;
      email: string | null;
    }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Add state for add slab dialog and available slabs

  const [additionalRooms, setAdditionalRooms] = useState<Room[]>([]);
  const [stoneSearchResults, setStoneSearchResults] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [roomSlabs, setRoomSlabs] = useState<Record<string, RoomSlab[]>>({});

  const [stoneTypes, setStoneTypes] = useState<Record<string, string>>({});

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [showRoomSlabDialog, setShowRoomSlabDialog] = useState(false);
  const [currentRoomStoneId, setCurrentRoomStoneId] = useState<string | null>(
    null
  );

  // Add state for added slabs per room (separate from available slabs)
  const [addedRoomSlabs, setAddedRoomSlabs] = useState<
    Record<string, RoomSlab[]>
  >({});

  // Add state for selected main slab per room (from Slab Number dropdown)
  const [selectedRoomSlab, setSelectedRoomSlab] = useState<
    Record<string, RoomSlab | null>
  >({});

  // Function to fetch available stones (those with unsold slabs)

  // Modified search stones function to use the fetchAvailableStones

  // Function to fetch slabs for a specific stone
  const fetchSlabsForStone = async (stoneName: string, roomId: string) => {
    try {
      // First, find the stone ID by name
      const stoneResponse = await fetch(
        `/api/stones/search?name=${encodeURIComponent(
          stoneName
        )}&show_sold_out=true`
      );
      if (stoneResponse.ok) {
        const stoneData = await stoneResponse.json();
        if (stoneData.stones && stoneData.stones.length > 0) {
          const stoneId = stoneData.stones[0].id;

          // Then fetch slabs for this stone ID - use proper endpoint
          const slabsResponse = await fetch(
            `/api/stones/${stoneId}/slabs?available=true`
          );
          if (slabsResponse.ok) {
            const slabsData = await slabsResponse.json();
            setRoomSlabs((prev) => ({
              ...prev,
              [roomId]: slabsData.slabs || [],
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching slabs for stone:", error);
    }
  };

  // Handler for adding a new room
  const handleAddRoom = () => {
    // Get current values from the first room to use as defaults
    const firstRoomValues = {
      room: "Bathroom", // Default to Bathroom
      sink_type_id: "", // Empty sink by default
      color: stoneName || "",
      edge: form.getValues("edge") || "Flat",
      backsplash: form.getValues("backsplash") || "No",
      tear_out: form.getValues("tear_out") || "No",
      stove: undefined, // Undefined for bathroom
      waterfall: form.getValues("waterfall") || "No",
      corbels: form.getValues("corbels") || 0,
      seam: form.getValues("seam") || "Standard",
      ten_year_sealer: form.getValues("ten_year_sealer") || false,
    };

    const newRoom: Room = {
      id: `room_${Date.now()}`,
      room: firstRoomValues.room,
      sink_type_id: firstRoomValues.sink_type_id,
      color: firstRoomValues.color,
      slab_number: "",
      edge: firstRoomValues.edge,
      backsplash: firstRoomValues.backsplash,
      total_square_feet: null, // Allow null for square feet
      tear_out: firstRoomValues.tear_out,
      stove: undefined, // Undefined for bathroom
      waterfall: firstRoomValues.waterfall,
      corbels: firstRoomValues.corbels,
      seam: firstRoomValues.seam,
      ten_year_sealer: firstRoomValues.ten_year_sealer,
      is_full_slab: false,
    };
    setAdditionalRooms([...additionalRooms, newRoom]);
  };

  // Handler for removing a room
  const handleRemoveRoom = (roomId: string) => {
    setAdditionalRooms(additionalRooms.filter((room) => room.id !== roomId));
  };

  // Handler for selecting a slab in the add slab dialog

  // Handler for removing an additional slab
  const handleRemoveAdditionalSlab = (slabId: number) => {
    setAdditionalSlabs(additionalSlabs.filter((slab) => slab.id !== slabId));
  };

  // Определяем значение по умолчанию для ten_year_sealer
  const defaultTenYearSealer =
    stoneType?.toLowerCase() === "quartz" ? false : true;

  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      same_address: true,
      rooms: [roomSchema.parse({})],
    },
  });

  // Handler for adding a slab to a room

  // Устанавливаем значение ten_year_sealer при изменении stoneType
  useEffect(() => {
    if (stoneType) {
      form.setValue(
        "ten_year_sealer",
        stoneType.toLowerCase() === "quartz" ? false : true
      );
    }
  }, [stoneType, form]);

  const fullSubmit = useFullSubmit(form);

  // Add state to track disabled fields
  const [disabledFields, setDisabledFields] = useState({
    phone: false,
    email: false,
    billing_address: false,
  });

  // Focus the customer name input when the component mounts
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (customerInputRef.current) {
        customerInputRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timeout);
  }, []);

  // Watch for customer name changes to provide real-time suggestions
  useEffect(() => {
    const customerName = form.watch("name");

    if (customerName && customerName.length >= 2 && !isExistingCustomer) {
      const fetchCustomers = async () => {
        try {
          const response = await fetch(
            "/api/customers/search?term=" + encodeURIComponent(customerName)
          );
          if (response.ok) {
            const data = await response.json();
            // Limit to only the top 1 customer
            const limitedCustomers = (data.customers || []).slice(0, 1);
            setCustomerSuggestions(limitedCustomers);
            setShowSuggestions(limitedCustomers.length > 0);
          }
        } catch (error) {
          console.error("Error fetching customer suggestions:", error);
          setCustomerSuggestions([]);
          setShowSuggestions(false);
        }
      };

      fetchCustomers();
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [form.watch("name"), isExistingCustomer]);

  // Add useEffect to handle same_address changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "same_address" || name === "billing_address") {
        const sameAddress = form.getValues("same_address");
        const billingAddress = form.getValues("billing_address");

        if (sameAddress && billingAddress) {
          form.setValue("project_address", billingAddress, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };

  const handleAddToExistingSale = (saleId: number) => {
    if (!slabId) return;

    navigate(
      `/employee/stones/slabs/${slabId}/add-to-sale/${saleId}${location.search}`
    );
  };

  const handleSelectSuggestion = (customer: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  }) => {
    form.setValue("name", customer.name);
    form.setValue("customer_id", customer.id);

    // Set initial fields based on available suggestion data
    if (customer.address) {
      form.setValue("billing_address", customer.address);
      setDisabledFields((prev) => ({ ...prev, billing_address: true }));
      if (form.getValues("same_address")) {
        form.setValue("project_address", customer.address);
      }
    } else {
      form.setValue("billing_address", "");
      setDisabledFields((prev) => ({ ...prev, billing_address: false }));
    }

    // Handle phone - disable only if it has a value
    if (customer.phone) {
      form.setValue("phone", customer.phone);
      setDisabledFields((prev) => ({ ...prev, phone: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, phone: false }));
    }

    // Handle email - disable only if it has a value
    if (customer.email) {
      form.setValue("email", customer.email);
      setDisabledFields((prev) => ({ ...prev, email: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, email: false }));
    }

    setIsExistingCustomer(true);
    setShowSuggestions(false);

    // Fetch full customer details to ensure we have complete data
    fetchCustomerDetails(customer.id);
  };

  // Function to load full customer details when selecting a customer
  const fetchCustomerDetails = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          // Update form with all customer details
          form.setValue("name", data.customer.name);

          // Set billing address and track if it should be disabled (only if it has a value)
          if (data.customer.address) {
            form.setValue("billing_address", data.customer.address);
            setDisabledFields((prev) => ({ ...prev, billing_address: true }));

            // If same_address is true, also set project_address
            if (form.getValues("same_address")) {
              form.setValue("project_address", data.customer.address);
            }
          } else {
            form.setValue("billing_address", "");
            setDisabledFields((prev) => ({ ...prev, billing_address: false }));
          }

          // Set phone and track if it should be disabled (only if it has a value)
          if (data.customer.phone) {
            form.setValue("phone", data.customer.phone);
            setDisabledFields((prev) => ({ ...prev, phone: true }));
          } else {
            form.setValue("phone", "");
            setDisabledFields((prev) => ({ ...prev, phone: false }));
          }

          // Set email and track if it should be disabled (only if it has a value)
          if (data.customer.email) {
            form.setValue("email", data.customer.email);
            setDisabledFields((prev) => ({ ...prev, email: true }));
          } else {
            form.setValue("email", "");
            setDisabledFields((prev) => ({ ...prev, email: false }));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
    }
  };

  const filteredSales = allSales.filter((sale) =>
    sale.customer_name.toLowerCase().includes(saleSearch.toLowerCase())
  );

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 150);
  };

  // Watch for color changes in additional rooms to update stone type label
  useEffect(() => {
    additionalRooms.forEach((room) => {
      if (room.color && stoneTypes[room.color]) {
        // The room has a color that matches a known stone type
        // We can use this later to show the stone type label
      }
    });
  }, [additionalRooms, stoneTypes]);

  // Determine default room ten_year_sealer value based on stone type

  // Fix form.watch by using a direct approach

  // Helper for getting stone type display for additional rooms
  const getRoomStoneTypeDisplay = (roomColor: string) => {
    if (!roomColor || !stoneTypes[roomColor]) return null;

    const roomStoneType = stoneTypes[roomColor];
    return (
      <>
        <span
          className={`ml-2 text-xs px-2 py-1 rounded ${
            roomStoneType.toLowerCase() === "quartz"
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {roomStoneType.charAt(0).toUpperCase() + roomStoneType.slice(1)}
        </span>
        <p className="text-xs text-gray-500 mt-1 ml-10">
          {roomStoneType.toLowerCase() === "quartz"
            ? "Quartz doesn't require a 10-year sealer"
            : "Natural stones require a 10-year sealer"}
        </p>
      </>
    );
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" method="post">
            <div className="">
              <div className="flex items-start gap-2">
                <div className="flex-grow relative">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <InputItem
                        name={"Customer Name"}
                        placeholder={"Enter customer name"}
                        field={{
                          ...field,
                          disabled: isExistingCustomer,
                          onChange: (
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            field.onChange(e);
                            if (isExistingCustomer) {
                              setIsExistingCustomer(false);
                              form.setValue("customer_id", undefined);
                            }
                          },
                        }}
                        ref={customerInputRef}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 mr-1 flex items-center gap-1">
                      <span>Existing</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsExistingCustomer(false);
                          form.setValue("customer_id", undefined);
                          setDisabledFields((prev) => ({
                            ...prev,
                            billing_address: false,
                            phone: false,
                            email: false,
                          }));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full -mt-4 max-h-20 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg"
                    >
                      <ul className="py-1 divide-y divide-gray-200">
                        {customerSuggestions.map((customer) => (
                          <li
                            key={customer.id}
                            className="px-2 py-0.5 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleSelectSuggestion(customer)}
                          >
                            {customer.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => <input type="hidden" {...field} />}
              />

              <AddressInput form={form} field="billing_address" />
              <div className="flex items-center space-x-2 my-2">
                <FormField
                  control={form.control}
                  name="same_address"
                  render={({ field }) => (
                    <>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="same_address"
                        label="Project address same as billing address"
                      />
                    </>
                  )}
                />
              </div>

              {!form.watch("same_address") && (
                <AddressInput form={form} field="project_address" />
              )}

              <div className="flex flex-row gap-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <InputItem
                      name={"Phone Number"}
                      placeholder={"317-316-1456"}
                      field={{
                        ...field,
                        disabled: disabledFields.phone,
                      }}
                      formClassName="mb-0 w-1/2"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <InputItem
                      name={"Email"}
                      placeholder={"Colin@gmail.com"}
                      field={{
                        ...field,
                        disabled: disabledFields.email,
                      }}
                      formClassName="mb-0 w-1/2"
                    />
                  )}
                />
              </div>

              {form.watch("rooms").map((room, index) => (
                <RoomSubForm
                  form={form}
                  index={index}
                  sinks={sinks}
                  stoneType={stoneType}
                />
              ))}

              {/* Additional Rooms */}

              {/* Move Add Room button after all rooms */}
              <div className="flex mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRoom}
                >
                  + Add Room
                </Button>
              </div>

              <div className="flex flex-row gap-2 mt-6">
                <FormField
                  control={form.control}
                  name="notes_to_sale"
                  render={({ field }) => (
                    <InputItem
                      name={"Notes"}
                      placeholder={"Notes to Sale"}
                      field={field}
                      formClassName="mb-0 w-3/4"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <InputItem
                      name={"Price"}
                      placeholder={"Enter price"}
                      field={field}
                      formClassName="mb-0 w-1/4"
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 items-center justify-between mt-4">
              <Button
                type="button"
                variant="blue"
                className="sm:order-1 order-2 sm:ml-0 ml-auto"
                onClick={() => setShowExistingSales(true)}
              >
                Add to Existing Sale
              </Button>
              <LoadingButton
                loading={isSubmitting}
                className="sm:order-2 order-1 sm:ml-auto ml-0"
              >
                Create Sale
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>

        {showExistingSales && (
          <Dialog open={showExistingSales} onOpenChange={setShowExistingSales}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Select Existing Sale</DialogTitle>
              </DialogHeader>
              <div className="relative mb-4">
                <Input
                  placeholder="Search sales by customer..."
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredSales.length === 0 ? (
                  <p className="text-center py-4">No sales found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAddToExistingSale(sale.id)}
                      >
                        <div className="font-medium">{sale.customer_name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(sale.sale_date).toLocaleDateString()}
                          {sale.notes && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Notes:</span>{" "}
                              {sale.notes}
                            </div>
                          )}
                          {sale.square_feet > 0 && (
                            <div className="text-xs text-gray-600">
                              <span className="font-semibold">
                                Total Square Feet:
                              </span>{" "}
                              {sale.square_feet}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
