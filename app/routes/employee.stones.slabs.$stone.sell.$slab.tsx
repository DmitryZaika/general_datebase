import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  useLoaderData,
  useLocation,
} from "react-router";
import { Form, useNavigate } from "react-router";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { InputItem } from "~/components/molecules/InputItem";
import { PhoneInput } from "~/components/molecules/PhoneInput";
import { EmailInput } from "~/components/molecules/EmailInput";
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
import { LoadingButton } from "~/components/molecules/LoadingButton";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { selectMany } from "~/utils/queryHelpers";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { customerSchema, roomSchema, TCustomerSchema } from "~/schemas/sales";
import { Switch } from "~/components/ui/switch";
import { SelectInputOther } from "~/components/molecules/SelectInputOther";
import { AddressInput } from "~/components/organisms/AddressInput";
import { useQuery } from "@tanstack/react-query";
import { Customer, StoneSearchResult } from "~/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { useFullSubmit } from "~/hooks/useFullSubmit";

interface Sink {
  id: number;
  name: string;
  type: string;
  retail_price: number;
  sink_count: number;
}

interface Faucet {
  id: number;
  name: string;
  type: string;
  retail_price: number;
  faucet_count: number;
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
  { key: "N/A", value: "N/A" },
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
  const { errors, data, receivedValues } =
    await getValidatedFormData<TCustomerSchema>(request, resolver);
  if (errors) {
    return { errors, receivedValues };
  }

  const slabId = params.slab;
  if (!slabId) {
    return { error: "Slab ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";
  let saleId: number;

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

      const updateFields = [];
      const updateValues = [];

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

      if (
        data.email &&
        (!customerVerify[0].email || customerVerify[0].email === "")
      ) {
        updateFields.push("email = ?");
        updateValues.push(data.email);
      }

      if (updateFields.length > 0) {
        await db.execute(
          `UPDATE customers SET ${updateFields.join(
            ", "
          )} WHERE id = ? AND company_id = ?`,
          [...updateValues, customerId, user.company_id]
        );
      }

      if (!data.billing_address && customerVerify[0].address) {
        data.billing_address = customerVerify[0].address;
      }

      if (data.same_address && data.billing_address) {
        data.project_address = data.billing_address;
      }
    } else {
      const [customerResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO customers (name, company_id, phone, email, address, postal_code) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          user.company_id,
          data.phone || null,
          data.email || null,
          data.billing_address || null,
          data.billing_zip_code || null,
        ]
      );
      customerId = customerResult.insertId;
    }

    const totalSquareFeet = data.rooms.reduce(
      (sum, room) => sum + (room.square_feet || 0),
      0
    );

    const [salesResult] = await db.execute<ResultSetHeader>(
      `INSERT INTO sales (customer_id, seller_id, company_id, sale_date, notes, status, square_feet, cancelled_date, installed_date, price, project_address) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'pending', ?, NULL, NULL, ?, ?)`,
      [
        customerId,
        user.id,
        user.company_id,
        data.notes_to_sale || null,
        totalSquareFeet,
        data.price || 0,
        data.project_address || null,
      ]
    );

    saleId = salesResult.insertId;

    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
          if (slab.is_full) {
            // Full slab sale: update the main slab with sale information
            await db.execute(
              `UPDATE slab_inventory SET sale_id = ?, seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
              [
                saleId,
                room.seam,
                room.edge,
                room.room,
                room.backsplash,
                room.tear_out,
                room.square_feet,
                room.stove,
                room.ten_year_sealer,
                room.waterfall,
                room.corbels,
                slab.id,
              ]
            );

            // Assign sinks and faucets to the main slab
            for (const sinkType of room.sink_type) {
              await db.execute(
                `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, sinkType.id]
              );
            }
            for (const faucetType of room.faucet_type) {
              await db.execute(
                `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, faucetType.id]
              );
            }
          } else {
            // Partial slab sale: update main slab with sale info AND create a copy
            await db.execute(
              `UPDATE slab_inventory SET sale_id = ?, seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
              [
                saleId,
                room.seam,
                room.edge,
                room.room,
                room.backsplash,
                room.tear_out,
                room.square_feet,
                room.stove,
                room.ten_year_sealer,
                room.waterfall,
                room.corbels,
                slab.id,
              ]
            );

            // Assign sinks and faucets to the main slab
            for (const sinkType of room.sink_type) {
              await db.execute(
                `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, sinkType.id]
              );
            }
            for (const faucetType of room.faucet_type) {
              await db.execute(
                `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, faucetType.id]
              );
            }

            // Create a copy of the slab (remaining portion) with parent_id
            const [slabDimensionsForRoom] = await db.execute<RowDataPacket[]>(
              `SELECT length, width, stone_id, bundle, url FROM slab_inventory WHERE id = ?`,
              [slab.id]
            );

            if (slabDimensionsForRoom && slabDimensionsForRoom.length > 0) {
              await db.execute<ResultSetHeader>(
                `INSERT INTO slab_inventory 
                 (stone_id, bundle, length, width, url, parent_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  slabDimensionsForRoom[0].stone_id,
                  slabDimensionsForRoom[0].bundle,
                  slabDimensionsForRoom[0].length,
                  slabDimensionsForRoom[0].width,
                  slabDimensionsForRoom[0].url,
                  slab.id,
                ]
              );
            }
          }
        }
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

  const separator = searchString ? "&" : "?";
  return redirect(`..${searchString}${separator}saleId=${saleId}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const user = await getEmployeeUser(request);

    if (!params.slab) {
      throw new Error("Slab ID is missing");
    }
    const slabId = parseInt(params.slab, 10);

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
    const stoneId = stoneInfo.length > 0 ? stoneInfo[0].id : null;
    const stoneType = stoneInfo.length > 0 ? stoneInfo[0].type : null;
    const stoneName = stoneInfo.length > 0 ? stoneInfo[0].name : null;

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

    const sink_type = await selectMany<Sink>(
      db,
      `SELECT
        sink_type.id,
        sink_type.name,
        sink_type.retail_price,
        sink_type.type,
        COUNT(sinks.id) AS sink_count
      FROM
        main.sink_type 
        JOIN main.sinks
          ON sink_type.id = sinks.sink_type_id
      WHERE
        sink_type.company_id = ?
          AND sinks.is_deleted != 1
          AND sinks.slab_id IS NULL
      GROUP BY
        sink_type.id,
        sink_type.name,
        sink_type.retail_price,
        sink_type.type
      ORDER BY
        sink_type.name ASC;
      `,
      [user.company_id]
    );

    const faucet_type = await selectMany<Faucet>(
      db,
      `SELECT
        faucet_type.id,
        faucet_type.name,
        faucet_type.retail_price,
        faucet_type.type,
        COUNT(faucets.id) AS faucet_count
      FROM
        main.faucet_type 
        JOIN main.faucets
          ON faucet_type.id = faucets.faucet_type_id
      WHERE
        faucet_type.company_id = ?
          AND faucets.is_deleted != 1
          AND faucets.slab_id IS NULL
      GROUP BY
        faucet_type.id,
        faucet_type.name,
        faucet_type.retail_price,
        faucet_type.type
      ORDER BY
        faucet_type.name ASC;
      `,
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
      sink_type,
      faucet_type,
      allSales,
      customers,
      stoneType,
      stoneName,
      bundle,
      stoneId,
      slabId,
    };
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
};

async function getSlabs(
  stoneId: number,
  slabIds: number[]
): Promise<
  {
    id: number;
    bundle: string;
  }[]
> {
  const cleanParam = encodeURIComponent(JSON.stringify(slabIds));
  const response = await fetch(
    `/api/stones/${stoneId}/slabs?exclude=${cleanParam}&available=true`
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
  setSlabMap,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<TCustomerSchema>;
  stoneId: number;
  roomIndex: number;
  setSlabMap: (
    slabMap: (
      prev: Record<number, string | null>
    ) => Record<number, string | null>
  ) => void;
}) => {
  type SlabState = { id: number; bundle: string } | undefined;
  const [selectedSlab, setSelectedSlab] = useState<SlabState>();

  const allRooms = form.watch("rooms");
  const addedSlabIds = allRooms.flatMap((room) =>
    room.slabs.map((slab) => slab.id)
  );

  const { data = [] } = useQuery({
    queryKey: ["slabs", stoneId, addedSlabIds],
    queryFn: () => getSlabs(stoneId, addedSlabIds),
    enabled: !!stoneId && show,
  });

  const handleAddSlab = () => {
    if (!selectedSlab) {
      return;
    }
    form.setValue(`rooms.${roomIndex}.slabs`, [
      ...form.getValues(`rooms.${roomIndex}.slabs`),
      {
        id: selectedSlab.id,
        is_full: false,
      },
    ]);
    setShow(false);
    setSlabMap((prev) => ({ ...prev, [selectedSlab.id]: selectedSlab.bundle }));
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Slab</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No available slabs found for this stone
            </div>
          ) : (
            <Select
              value={selectedSlab?.bundle || ""}
              onValueChange={(val) =>
                setSelectedSlab(data.find((slab) => slab.bundle === val))
              }
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Select a slab" />
              </SelectTrigger>
              <SelectContent>
                {data.map((slab) => (
                  <SelectItem key={slab.id} value={slab.bundle}>
                    {slab.bundle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddSlab} disabled={!selectedSlab}>
            Add Slab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddSinkDialog = ({
  show,
  setShow,
  form,
  roomIndex,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<TCustomerSchema>;
  roomIndex: number;
}) => {
  const { sink_type } = useLoaderData<typeof loader>();
  const [selectedSink, setSelectedSink] = useState<number>();

  const handleAddSink = () => {
    if (!selectedSink) {
      return;
    }
    form.setValue(`rooms.${roomIndex}.sink_type`, [
      ...form.getValues(`rooms.${roomIndex}.sink_type`),
      {
        id: selectedSink,
      },
    ]);
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {sink_type.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No available sinks found
            </div>
          ) : (
            <Select
              value={selectedSink?.toString() || ""}
              onValueChange={(val) => setSelectedSink(parseInt(val))}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Select a sink" />
              </SelectTrigger>
              <SelectContent>
                {sink_type.map((sink) => (
                  <SelectItem key={sink.id} value={sink.id.toString()}>
                    {sink.name} - ${sink.retail_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddSink} disabled={!selectedSink}>
            Add Sink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddFaucetDialog = ({
  show,
  setShow,
  form,
  roomIndex,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<TCustomerSchema>;
  roomIndex: number;
}) => {
  const { faucet_type } = useLoaderData<typeof loader>();
  const [selectedFaucet, setSelectedFaucet] = useState<number>();

  const handleAddFaucet = () => {
    if (!selectedFaucet) {
      return;
    }
    const currentFaucets = (form.getValues(
      `rooms.${roomIndex}.faucet_type` as any
    ) || []) as any[];
    (form.setValue as any)(`rooms.${roomIndex}.faucet_type`, [
      ...currentFaucets,
      {
        id: selectedFaucet,
      },
    ]);
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Faucet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {faucet_type.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No available faucets found
            </div>
          ) : (
            <Select
              value={selectedFaucet?.toString() || ""}
              onValueChange={(val) => setSelectedFaucet(parseInt(val))}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Select a faucet" />
              </SelectTrigger>
              <SelectContent>
                {faucet_type.map((faucet) => (
                  <SelectItem key={faucet.id} value={faucet.id.toString()}>
                    {faucet.name} - ${faucet.retail_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShow(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddFaucet} disabled={!selectedFaucet}>
            Add Faucet
          </Button>
        </DialogFooter>
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
  stoneName,
  setStone,
}: {
  stoneName: string | null;
  setStone: (value: { id: number; type: string }) => void;
}) => {
  const [searchValue, setSearchValue] = useState(stoneName || undefined);
  const [show, setShow] = useState(!stoneName);
  const { data, isLoading } = useQuery({
    queryKey: ["availableStones", searchValue],
    queryFn: () => fetchAvailableStones(searchValue),
    enabled: !!searchValue,
  });

  const handleStoneSelect = (stone: { id: number; name: string }) => {
    setStone({ id: stone.id, type: data?.stoneType[stone.name] || "" });
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
      <label className="text-sm font-medium">Stone</label>
      <div className="relative">
        <Input
          placeholder="Search stone colors..."
          value={searchValue}
          disabled={!!stoneName}
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
  sink_type,
  faucet_type,
  slabMap,
  stoneType,
  setSlabMap,
}: {
  form: UseFormReturn<TCustomerSchema>;
  index: number;
  sink_type: Sink[];
  faucet_type: Faucet[];
  stoneType: string | null;
  slabMap: Record<number, string | null>;
  setSlabMap: (
    slabMap: (
      prev: Record<number, string | null>
    ) => Record<number, string | null>
  ) => void;
}) => {
  const [showAddSlabDialog, setShowAddSlabDialog] = useState(false);
  const [showAddSinkDialog, setShowAddSinkDialog] = useState(false);
  const [showAddFaucetDialog, setShowAddFaucetDialog] = useState(false);

  const {
    slabId,
    stoneId: tempStoneId,
    bundle,
    stoneName,
  } = useLoaderData<typeof loader>();
  const [stone, setStone] = useState<{
    id: number;
    type: string | null;
  } | null>(
    tempStoneId && index === 0 ? { id: tempStoneId, type: stoneType } : null
  );

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

  useEffect(() => {
    if (stoneType) {
      form.setValue(
        `rooms.${index}.ten_year_sealer`,
        stone?.type?.toLowerCase() === "quartz" ? false : true
      );
    }
  }, [stoneType, index, stone?.type]);

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

  useEffect(() => {
    if (form.getValues(`rooms.${index}.room`) === "bathroom") {
      form.setValue(`rooms.${index}.stove`, "N/A");
    }
  }, [form.getValues(`rooms.${index}.room`)]);

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
          stoneName={index === 0 ? stoneName : null}
          setStone={setStone}
        />

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
          name={`rooms.${index}.square_feet`}
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
                disabled={Boolean(stone?.type?.toLowerCase() === "quartz")}
                label="10-Year Sealer"
              />
              {stone?.type && <StoneTypeDisplay stoneType={stone?.type} />}
            </>
          )}
        />
      </div>

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
                    Bundle {slabMap[slab.id]}
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
          <AddSlabDialog
            show={showAddSlabDialog}
            setShow={setShowAddSlabDialog}
            roomIndex={index}
            form={form}
            stoneId={stone?.id}
            setSlabMap={setSlabMap}
          />
          <AddSinkDialog
            show={showAddSinkDialog}
            setShow={setShowAddSinkDialog}
            roomIndex={index}
            form={form}
          />
          <AddFaucetDialog
            show={showAddFaucetDialog}
            setShow={setShowAddFaucetDialog}
            roomIndex={index}
            form={form}
          />
        </>
      )}
    </>
  );
};

export default function SlabSell() {
  const {
    sink_type,
    faucet_type,
    allSales,
    customers,
    stoneType,
    stoneName,
    bundle,
    slabId,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const [showExistingSales, setShowExistingSales] = useState(false);
  const [saleSearch, setSaleSearch] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const location = useLocation();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [slabMap, setSlabMap] = useState<Record<number, string | null>>({
    [slabId]: bundle,
  });

  const form = useForm<TCustomerSchema>({
    resolver,
    defaultValues: {
      same_address: true,
      rooms: [roomSchema.parse({})],
    },
  });

  const fullSubmit = useFullSubmit(form, undefined, "POST", (value) => {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value;
  });

  const handleAddRoom = () => {
    const currentRooms = form.getValues("rooms");
    let newRoom = roomSchema.parse({});

    if (currentRooms.length > 0) {
      const firstRoom = currentRooms[0];
      newRoom = {
        ...newRoom,
        edge: firstRoom.edge,
        tear_out: firstRoom.tear_out,
        stove: firstRoom.stove,
        waterfall: "No",
        seam: firstRoom.seam,
        ten_year_sealer: firstRoom.ten_year_sealer,
      };
    }

    if (currentRooms.length > 0) {
      newRoom.room = "bathroom";
      newRoom.backsplash = "4 inch";
    }

    form.setValue("rooms", [...currentRooms, newRoom]);
  };

  const [disabledFields, setDisabledFields] = useState({
    phone: false,
    email: false,
    billing_address: false,
  });

  const fetchCustomers = async (customerName: string) => {
    const response = await fetch(
      "/api/customers/search?term=" + encodeURIComponent(customerName)
    );
    if (!response.ok) {
      throw new Error("Failed to fetch slabs");
    }
    const data = await response.json();
    const limitedCustomers: Customer[] = (data.customers || []).slice(0, 1);
    return limitedCustomers;
  };

  const { data: customerSuggestions = [], isLoading } = useQuery({
    queryKey: ["customers", form.watch("name")],
    queryFn: () => fetchCustomers(form.watch("name")),
    enabled: !!form.watch("name"),
  });

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

    if (customer.phone) {
      form.setValue("phone", customer.phone);
      setDisabledFields((prev) => ({ ...prev, phone: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, phone: false }));
    }

    if (customer.email) {
      form.setValue("email", customer.email);
      setDisabledFields((prev) => ({ ...prev, email: true }));
    } else {
      setDisabledFields((prev) => ({ ...prev, email: false }));
    }

    setIsExistingCustomer(true);
    setShowSuggestions(false);

    fetchCustomerDetails(customer.id);
  };

  const fetchCustomerDetails = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          form.setValue("name", data.customer.name);

          if (data.customer.address) {
            form.setValue("billing_address", data.customer.address);
            setDisabledFields((prev) => ({ ...prev, billing_address: true }));

            if (form.getValues("same_address")) {
              form.setValue("project_address", data.customer.address);
            }
          } else {
            form.setValue("billing_address", "");
            setDisabledFields((prev) => ({ ...prev, billing_address: false }));
          }

          if (data.customer.phone) {
            form.setValue("phone", data.customer.phone);
            setDisabledFields((prev) => ({ ...prev, phone: true }));
          } else {
            form.setValue("phone", "");
            setDisabledFields((prev) => ({ ...prev, phone: false }));
          }

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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("name", e.target.value);
    if (!showSuggestions) {
      setShowSuggestions(true);
    }
    if (isExistingCustomer) {
      setIsExistingCustomer(false);
      form.setValue("customer_id", undefined);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Slab - Add Customer</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
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
                          onChange: handleNameChange,
                        }}
                      />
                    )}
                  />
                  {isExistingCustomer && (
                    <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 text-xs px-2 rounded-md flex items-center gap-1">
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
                        <X className="h-2 w-2" />
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

              <AddressInput
                form={form}
                field="billing_address"
                zipField="billing_zip_code"
              />
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
                    <PhoneInput
                      field={field}
                      formClassName="mb-0 w-1/2"
                      disabled={disabledFields.phone}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <EmailInput
                      field={{
                        ...field,
                        disabled: disabledFields.email,
                      }}
                      formClassName="mb-0"
                    />
                  )}
                />
              </div>

              {form.watch("rooms").map((room, index) => (
                <RoomSubForm
                  key={index}
                  slabMap={slabMap}
                  setSlabMap={setSlabMap}
                  form={form}
                  index={index}
                  sink_type={sink_type}
                  faucet_type={faucet_type}
                  stoneType={stoneType}
                />
              ))}

              <div className="flex mt-4">
                <Button
                  type="button"
                  variant="blue"
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

            <DialogFooter className="flex flex-col sm:flex-row gap-2  mt-4">
              {/* <Button
                type="button"
                variant="blue"
                className="sm:order-1 order-2 sm:ml-0 ml-auto"
                onClick={() => setShowExistingSales(true)}
              >
                Add to Existing Sale
              </Button> */}
              <LoadingButton
                loading={isSubmitting}
                className="sm:order-2 order-1 sm:ml-auto ml-0"
                type="submit"
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
