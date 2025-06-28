import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useNavigation,
  useLoaderData,
  useLocation,
  useParams,
} from "react-router";
import { Form, useNavigate } from "react-router";
import { FormProvider, FormField } from "../components/ui/form";
import { getValidatedFormData } from "remix-hook-form";
import { InputItem } from "~/components/molecules/InputItem";
import { PhoneInput } from "~/components/molecules/PhoneInput";
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
import { X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { customerSchema, roomSchema, TCustomerSchema } from "~/schemas/sales";
import { Switch } from "~/components/ui/switch";
import { SelectInputOther } from "~/components/molecules/SelectInputOther";
import { SelectInput } from "~/components/molecules/SelectItem";
import { AddressInput } from "~/components/organisms/AddressInput";
import { useQuery } from "@tanstack/react-query";
import { Customer, StoneSearchResult } from "~/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { useFullSubmit } from "~/hooks/useFullSubmit";
import React from "react";
import { EmailInput } from "~/components/molecules/EmailInput";

// Copy all the same interfaces and options from sell page
interface Sink {
  id: number;
  name: string;
  type: string;
  retail_price: number;
  sink_count: number;
}

interface SaleData {
  id: number;
  customer_id: number;
  customer_name: string;
  seller_id: number;
  billing_address: string;
  project_address: string;
  phone: string;
  email: string;
  price: number;
  notes_to_sale: string;
  sale_date: string;
  rooms: {
    room: string;
    edge: string;
    backsplash: string;
    square_feet: number;
    tear_out: string;
    stove: string;
    waterfall: string;
    corbels: number;
    seam: string;
    ten_year_sealer: boolean;
    slabs: Array<{ id: number; is_full: boolean; bundle: string }>;
    sink_type: Array<{ id: number; name: string }>;
    faucet_type: Array<{ id: number; name: string }>;
  }[];
  company_name?: string | null;
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

  const saleId = params.saleId;
  if (!saleId) {
    return { error: "Sale ID is missing" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  try {
    const [saleCheck] = await db.execute<RowDataPacket[]>(
      `SELECT id, company_id FROM sales WHERE id = ?`,
      [saleId]
    );

    if (!saleCheck || saleCheck.length === 0) {
      throw new Error("Sale not found");
    }

    if (saleCheck[0].company_id !== user.company_id) {
      throw new Error("Sale belongs to different company");
    }

    let customerId: number;

    if (data.customer_id) {
      customerId = data.customer_id;

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (data.billing_address) {
        updateFields.push("address = ?");
        updateValues.push(data.billing_address);
      }

      if (data.phone) {
        updateFields.push("phone = ?");
        updateValues.push(data.phone);
      }

      if (data.email) {
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

      if (data.builder && data.company_name) {
        await db.execute(
          `UPDATE customers SET company_name = ? WHERE id = ? AND company_id = ?`,
          [data.company_name, customerId || data.customer_id, user.company_id]
        );
      } else {
        await db.execute(
          `UPDATE customers SET company_name = NULL WHERE id = ? AND company_id = ?`,
          [customerId || data.customer_id, user.company_id]
        );
      }
    } else {
      const [customerResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO customers (name, address, phone, email, company_id) VALUES (?, ?, ?, ?, ?)`,
        [
          data.name,
          data.billing_address,
          data.phone,
          data.email,
          user.company_id,
        ]
      );
      customerId = customerResult.insertId;
    }

    await db.execute(
      `UPDATE sales SET customer_id = ?, project_address = ?, price = ?, notes = ?, seller_id = ? WHERE id = ? AND company_id = ?`,
      [
        customerId,
        data.project_address,
        data.price,
        data.notes_to_sale || null,
        data.seller_id,
        saleId,
        user.company_id,
      ]
    );

    await db.execute(
      `UPDATE sinks SET slab_id = NULL, is_deleted = 0, price = NULL WHERE slab_id IN (SELECT id FROM slab_inventory WHERE sale_id = ?)`,
      [saleId]
    );
    await db.execute(
      `UPDATE faucets SET slab_id = NULL, is_deleted = 0, price = NULL WHERE slab_id IN (SELECT id FROM slab_inventory WHERE sale_id = ?)`,
      [saleId]
    );

    // Get all current slabs in the sale to compare with the form data
    const [currentSlabs] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM slab_inventory WHERE sale_id = ?`,
      [saleId]
    );
    const currentSlabIds = currentSlabs.map((slab) => slab.id);

    // Collect all slab IDs from the form
    const formSlabIds: number[] = [];
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
          formSlabIds.push(slab.id);
        }
      }
    }

    // Find slabs that were removed from the form (exist in DB but not in form)
    const removedSlabIds = currentSlabIds.filter(
      (id) => !formSlabIds.includes(id)
    );

    // Clear sale information from removed slabs
    for (const slabId of removedSlabIds) {
      await db.execute(
        `UPDATE slab_inventory SET sale_id = NULL, seam = NULL, edge = NULL, room = NULL, 
         backsplash = NULL, tear_out = NULL, square_feet = NULL, stove = NULL, 
         ten_year_sealer = NULL, waterfall = NULL, corbels = NULL WHERE id = ?`,
        [slabId]
      );
      // Also delete any unsold children of this slab
      await db.execute(
        `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
        [slabId]
      );
    }

    // First, ensure all slabs in the form have sale_id set (for newly added slabs)
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
          // Set sale_id for any slabs that don't have it yet (newly added slabs)
          await db.execute(
            `UPDATE slab_inventory SET sale_id = ? WHERE id = ? AND sale_id IS NULL`,
            [saleId, slab.id]
          );
        }
      }
    }

    // Handle child slab deletion when slab is marked as partial sale
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
          if (slab.is_full) {
            await db.execute(
              `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
              [slab.id]
            );
          }
        }
      }
    }

    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
          if (slab.is_full) {
            await db.execute(
              `UPDATE slab_inventory SET seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
              [
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

            for (const sinkType of room.sink_type) {
              await db.execute(
                `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, sinkType.id]
              );
            }
            for (const faucetType of room.faucet_type || []) {
              await db.execute(
                `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, faucetType.id]
              );
            }
          } else {
            await db.execute(
              `UPDATE slab_inventory SET seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
              stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ? WHERE id = ?`,
              [
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
            for (const faucetType of room.faucet_type || []) {
              await db.execute(
                `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
                [slab.id, faucetType.id]
              );
            }

            // Check if copy already exists
            const [existingCopy] = await db.execute<RowDataPacket[]>(
              `SELECT id FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
              [slab.id]
            );

            if (!existingCopy || existingCopy.length === 0) {
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
    }

    const session = await getSession(request.headers.get("Cookie"));
    session.flash(
      "message",
      toastData("Sale updated successfully!", "success")
    );

    return redirect(`/employee/stones/slabs/${params.stone}${searchString}`, {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error: any) {
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData(error.message, "destructive"));

    return {
      errors: { _form: error.message },
      receivedValues,
    };
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  if (!params.saleId || !params.stone) {
    throw new Response("Missing parameters", { status: 400 });
  }

  const saleId = parseInt(params.saleId);
  const stoneId = parseInt(params.stone);

  // Get sale details
  const [saleData] = await db.execute<RowDataPacket[]>(
    `SELECT 
      s.id, s.customer_id, c.name as customer_name, c.address as billing_address, 
      s.project_address, c.phone, c.email, c.company_name, s.price, s.notes as notes_to_sale, s.sale_date, s.seller_id
     FROM sales s
     JOIN customers c ON s.customer_id = c.id
     WHERE s.id = ? AND s.company_id = ?`,
    [saleId, user.company_id]
  );

  if (!saleData || saleData.length === 0) {
    throw new Response("Sale not found", { status: 404 });
  }

  const sale = saleData[0] as typeof saleData[0] & { company_name?: string | null };

  // Get room details from slab_inventory
  const slabInventory = await selectMany<{
    id: number;
    stone_id: number;
    bundle: string;
    room: string;
    edge: string;
    backsplash: string;
    square_feet: number;
    tear_out: string;
    stove: string;
    waterfall: string;
    corbels: number;
    seam: string;
    ten_year_sealer: boolean;
    parent_id: number | null;
    sale_id: number | null;
  }>(db, `SELECT * FROM slab_inventory WHERE sale_id = ?`, [saleId]);

  // Get all children slabs to check is_full status
  const parentIds = slabInventory.map((slab) => slab.id);
  const childrenSlabs =
    parentIds.length > 0
      ? await selectMany<{
          id: number;
          parent_id: number;
          sale_id: number | null;
        }>(
          db,
          `
    SELECT id, parent_id, sale_id 
    FROM slab_inventory 
    WHERE parent_id IN (${parentIds.map(() => "?").join(",")})
  `,
          parentIds
        )
      : [];

  // Get sinks for each slab
  const sinks =
    slabInventory.length > 0
      ? await selectMany<{
          slab_id: number;
          sink_type_id: number;
          name: string;
        }>(
          db,
          `SELECT s.slab_id, s.sink_type_id, st.name 
     FROM sinks s 
     JOIN sink_type st ON s.sink_type_id = st.id 
     WHERE s.slab_id IN (${slabInventory.map(() => "?").join(",")})`,
          slabInventory.map((slab) => slab.id)
        )
      : [];

  // Get faucets for each slab
  const faucets =
    slabInventory.length > 0
      ? await selectMany<{
          slab_id: number;
          faucet_type_id: number;
          name: string;
        }>(
          db,
          `SELECT f.slab_id, f.faucet_type_id, ft.name 
     FROM faucets f 
     JOIN faucet_type ft ON f.faucet_type_id = ft.id 
     WHERE f.slab_id IN (${slabInventory.map(() => "?").join(",")})`,
          slabInventory.map((slab) => slab.id)
        )
      : [];

  // Group data by room characteristics to recreate room structure
  const roomsMap = new Map();

  slabInventory.forEach((slab) => {
    const roomKey = `${slab.room}-${slab.edge}-${slab.backsplash}-${slab.square_feet}-${slab.tear_out}-${slab.stove}-${slab.waterfall}-${slab.corbels}-${slab.seam}-${slab.ten_year_sealer}`;

    if (!roomsMap.has(roomKey)) {
      roomsMap.set(roomKey, {
        room: slab.room || "kitchen",
        edge: slab.edge || "Flat",
        backsplash: slab.backsplash || "No",
        square_feet: Number(slab.square_feet) || 0,
        tear_out: slab.tear_out || "No",
        stove: slab.stove || "F/S",
        waterfall: slab.waterfall || "No",
        corbels: Number(slab.corbels) || 0,
        seam: slab.seam || "Standard",
        ten_year_sealer: Boolean(slab.ten_year_sealer),
        slabs: [],
        sink_type: [],
        faucet_type: [],
      });
    }

    const room = roomsMap.get(roomKey);

    // Check if this slab has unsold children
    const hasUnsoldChildren = childrenSlabs.some(
      (child) => child.parent_id === slab.id && child.sale_id === null
    );

    room.slabs.push({
      id: slab.id,
      is_full: !hasUnsoldChildren, // If has unsold children -> false, if no children -> true
      bundle: slab.bundle,
    });

    // Add sinks for this slab
    const slabSinks = sinks.filter((sink) => sink.slab_id === slab.id);
    slabSinks.forEach((sink) => {
      if (!room.sink_type.find((s: any) => s.id === sink.sink_type_id)) {
        room.sink_type.push({
          id: sink.sink_type_id,
          name: sink.name,
        });
      }
    });

    // Add faucets for this slab
    const slabFaucets = faucets.filter((faucet) => faucet.slab_id === slab.id);
    slabFaucets.forEach((faucet) => {
      if (!room.faucet_type.find((f: any) => f.id === faucet.faucet_type_id)) {
        room.faucet_type.push({
          id: faucet.faucet_type_id,
          name: faucet.name,
        });
      }
    });
  });

  const rooms = Array.from(roomsMap.values());

  // Get available sink types
  const sink_type = await selectMany<Sink>(
    db,
    `SELECT id, name, type, retail_price, 0 as sink_count FROM sink_type WHERE company_id = ?`,
    [user.company_id]
  );

  // Get available faucet types
  const faucet_type = await selectMany<{
    id: number;
    name: string;
    type: string;
    retail_price: number;
    faucet_count: number;
  }>(
    db,
    `SELECT id, name, type, retail_price, 0 as faucet_count FROM faucet_type WHERE company_id = ?`,
    [user.company_id]
  );

  // Get stone information
  const [stoneInfo] = await db.execute<RowDataPacket[]>(
    `SELECT name, type FROM stones WHERE id = ?`,
    [stoneId]
  );

  // Get sales reps (sellers) - only Sales Rep (1) and Sales Manager (2)
  const salesReps = await selectMany<{
    id: number;
    name: string;
  }>(
    db,
    `SELECT id, name FROM users WHERE company_id = ? AND position_id IN (1, 2) ORDER BY name ASC`,
    [user.company_id]
  );

  const saleDataFormatted: SaleData = {
    id: sale.id,
    customer_id: sale.customer_id,
    customer_name: sale.customer_name,
    seller_id: sale.seller_id,
    billing_address: sale.billing_address || "",
    project_address: sale.project_address || "",
    phone: sale.phone || "",
    email: sale.email || "",
    price: sale.price || 0,
    notes_to_sale: sale.notes_to_sale || "",
    sale_date: sale.sale_date,
    company_name: sale.company_name || null,
    rooms:
      rooms.length > 0
        ? rooms.map((room) => ({
            ...room,
            room: room.room || "kitchen",
            edge: room.edge || "Flat",
            backsplash: room.backsplash || "No",
            square_feet: Number(room.square_feet) || 0,
            tear_out: room.tear_out || "No",
            stove: room.stove || "F/S",
            waterfall: room.waterfall || "No",
            corbels: Number(room.corbels) || 0,
            seam: room.seam || "Standard",
            ten_year_sealer: Boolean(room.ten_year_sealer),
          }))
        : [
            {
              room: "kitchen",
              edge: "Flat",
              backsplash: "No",
              square_feet: 0,
              tear_out: "No",
              stove: "F/S",
              waterfall: "No",
              corbels: 0,
              seam: "Standard",
              ten_year_sealer: false,
              slabs: [],
              sink_type: [],
              faucet_type: [],
            },
          ],
  };

  return {
    sale: saleDataFormatted,
    sink_type,
    faucet_type,
    salesReps,
    stoneType: stoneInfo?.[0]?.type || null,
    stoneName: stoneInfo?.[0]?.name || null,
  };
};

// Copy the exact same dialog components from sell page but adapted for editing
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
  const [selectedSlab, setSelectedSlab] = useState<
    { id: number; bundle: string } | undefined
  >(undefined);
  const [slabs, setSlabs] = useState<{ id: number; bundle: string }[]>([]);

  useEffect(() => {
    const fetchSlabs = async () => {
      if (!show || !stoneId) return;

      try {
        const response = await fetch(
          `/api/stones/${stoneId}/slabs?exclude=${encodeURIComponent(
            JSON.stringify([])
          )}&available=true`
        );
        if (response.ok) {
          const data = await response.json();
          setSlabs(data.slabs || []);
        }
      } catch (error) {
        console.error("Error fetching slabs:", error);
      }
    };

    fetchSlabs();
  }, [show, stoneId]);

  useEffect(() => {
    if (slabs.length > 0 && !selectedSlab) {
      setSelectedSlab(slabs[0]);
    }
  }, [slabs]);

  const handleAddSlab = () => {
    if (!selectedSlab) return;

    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[roomIndex];

    if (currentRoom) {
      const updatedSlabs = [
        ...currentRoom.slabs,
        { id: selectedSlab.id, is_full: true },
      ];

      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = { ...currentRoom, slabs: updatedSlabs };

      form.setValue("rooms", updatedRooms);

      setSlabMap((prev) => ({
        ...prev,
        [selectedSlab.id]: selectedSlab.bundle,
      }));
    }

    setSelectedSlab(undefined);
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Slab</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {slabs.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No available slabs found for this stone
            </div>
          ) : (
            <Select
              value={selectedSlab?.bundle || ""}
              onValueChange={(val) => {
                if (val) {
                  setSelectedSlab(slabs.find((slab) => slab.bundle === val));
                }
              }}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Select a slab" />
              </SelectTrigger>
              <SelectContent>
                {slabs.map((slab) => (
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
  sink_type,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<TCustomerSchema>;
  roomIndex: number;
  sink_type: Sink[];
}) => {
  const [selectedSink, setSelectedSink] = useState<string>("");

  const handleAddSink = () => {
    if (!selectedSink) return;

    const sink = sink_type.find((s) => s.id.toString() === selectedSink);
    if (!sink) return;

    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[roomIndex];

    if (currentRoom) {
      const updatedSinks = [...currentRoom.sink_type, { id: sink.id }];

      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = { ...currentRoom, sink_type: updatedSinks };

      form.setValue("rooms", updatedRooms);
    }

    setSelectedSink("");
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Sink</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedSink} onValueChange={setSelectedSink}>
            <SelectTrigger>
              <SelectValue placeholder="Select a sink" />
            </SelectTrigger>
            <SelectContent>
              {sink_type.map((sink) => (
                <SelectItem key={sink.id} value={sink.id.toString()}>
                  {sink.name} - {sink.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  faucet_type,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  form: UseFormReturn<TCustomerSchema>;
  roomIndex: number;
  faucet_type: Array<{
    id: number;
    name: string;
    type: string;
    retail_price: number;
    faucet_count: number;
  }>;
}) => {
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

// Copy the exact same RoomSubForm from sell page
const RoomSubForm = ({
  form,
  index,
  sink_type,
  faucet_type,
  slabMap,
  stoneType,
  stoneId,
  setSlabMap,
}: {
  form: UseFormReturn<TCustomerSchema>;
  index: number;
  sink_type: Sink[];
  faucet_type: Array<{
    id: number;
    name: string;
    type: string;
    retail_price: number;
    faucet_count: number;
  }>;
  stoneType: string | null;
  stoneId: number;
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

  const { stoneName } = useLoaderData<typeof loader>();
  const [stone, setStone] = useState<{
    id: number;
    type: string | null;
  } | null>(stoneId && index === 0 ? { id: stoneId, type: stoneType } : null);

  const room = form.watch(`rooms.${index}`);

  const handleSwitchSlab = (slabId: number, isFull: boolean) => {
    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[index];
    const updatedSlabs = currentRoom.slabs.map((slab) =>
      slab.id === slabId ? { ...slab, is_full: isFull } : slab
    );
    const updatedRooms = [...currentRooms];
    updatedRooms[index] = { ...currentRoom, slabs: updatedSlabs };
    form.setValue("rooms", updatedRooms);
  };

  const handleRemoveSlab = (slabId: number) => {
    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[index];
    const updatedSlabs = currentRoom.slabs.filter((slab) => slab.id !== slabId);
    const updatedRooms = [...currentRooms];
    updatedRooms[index] = { ...currentRoom, slabs: updatedSlabs };
    form.setValue("rooms", updatedRooms);

    setSlabMap((prev) => {
      const newMap = { ...prev };
      delete newMap[slabId];
      return newMap;
    });
  };

  const handleRemoveSink = (sinkIndex: number) => {
    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[index];
    const updatedSinks = currentRoom.sink_type.filter(
      (_, i) => i !== sinkIndex
    );
    const updatedRooms = [...currentRooms];
    updatedRooms[index] = { ...currentRoom, sink_type: updatedSinks };
    form.setValue("rooms", updatedRooms);
  };

  const handleRemoveFaucet = (faucetIndex: number) => {
    const currentRooms = form.getValues("rooms");
    const currentRoom = currentRooms[index];
    const updatedFaucets = currentRoom.faucet_type.filter(
      (_, i) => i !== faucetIndex
    );
    const updatedRooms = [...currentRooms];
    updatedRooms[index] = { ...currentRoom, faucet_type: updatedFaucets };
    form.setValue("rooms", updatedRooms);
  };

  const handleRemoveRoom = () => {
    const currentRooms = form.getValues("rooms");
    if (currentRooms.length > 1) {
      const updatedRooms = currentRooms.filter((_, i) => i !== index);
      form.setValue("rooms", updatedRooms);
    }
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
        <h2 className="mt-6 mb-2 font-semibold text-sm">Room {index + 1}</h2>
        {form.getValues("rooms").length > 1 && (
          <Button
            type="button"
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
                id={`ten_year_sealer_${index}`}
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
            {room?.slabs?.map((slab, slabIndex) => (
              <div
                key={slabIndex}
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
                    Bundle {slabMap[slab.id] || `${slab.id}`}
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
            {room?.sink_type?.map((sink, sinkIndex) => (
              <div
                key={sinkIndex}
                className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
              >
                <span>
                  {sink_type.find((s) => s.id === sink.id)?.name ||
                    "Unknown Sink"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemoveSink(sinkIndex)}
                >
                  <X className="h-4 w-4" />
                </Button>
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
            {room?.faucet_type?.map((faucet, faucetIndex) => (
              <div
                key={faucetIndex}
                className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
              >
                <span>
                  {faucet_type.find((f) => f.id === faucet.id)?.name ||
                    "Unknown Faucet"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemoveFaucet(faucetIndex)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddSlabDialog
        show={showAddSlabDialog}
        setShow={setShowAddSlabDialog}
        roomIndex={index}
        form={form}
        stoneId={stone?.id || stoneId}
        setSlabMap={setSlabMap}
      />
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
  );
};

// Main component - exactly like sell page but with pre-loaded data and "Update Sale" button
export default function SlabEdit() {
  const { sale, sink_type, faucet_type, salesReps, stoneType } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state === "submitting";
  const location = useLocation();
  const params = useParams();

  // Get stoneId from URL
  const stoneId = parseInt(location.pathname.split("/")[4]); // Extract from /employee/stones/slabs/{stoneId}/edit/{saleId}

  const [slabMap, setSlabMap] = useState<Record<number, string | null>>({});

  const form = useForm<TCustomerSchema>({
    resolver,
    defaultValues: {
      name: sale.customer_name,
      customer_id: sale.customer_id,
      seller_id: sale.seller_id,
      billing_address: sale.billing_address,
      project_address: sale.project_address,
      same_address: sale.billing_address === sale.project_address,
      phone: sale.phone,
      email: sale.email,
      price: sale.price,
      notes_to_sale: sale.notes_to_sale,
      rooms: sale.rooms.length > 0 ? sale.rooms : [roomSchema.parse({})],
      builder: Boolean(sale.company_name),
      company_name: sale.company_name || "",
    },
  });

  const fullSubmit = useFullSubmit(form, undefined, "POST", (value) => {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value;
  });

  // Initialize slab map
  useEffect(() => {
    const initialSlabMap: Record<number, string | null> = {};
    sale.rooms.forEach((room) => {
      room.slabs.forEach((slab) => {
        initialSlabMap[slab.id] = slab.bundle;
      });
    });
    setSlabMap(initialSlabMap);
  }, [sale]);

  const handleAddRoom = () => {
    const currentRooms = form.getValues("rooms");
    let newRoom = roomSchema.parse({});

    if (currentRooms.length > 0) {
      const firstRoom = currentRooms[0];
      newRoom = {
        ...newRoom,
        edge: firstRoom.edge,
        backsplash: firstRoom.backsplash,
        tear_out: firstRoom.tear_out,
        stove: firstRoom.stove,
        waterfall: firstRoom.waterfall,
        seam: firstRoom.seam,
        ten_year_sealer: firstRoom.ten_year_sealer,
      };
    }

    form.setValue("rooms", [...currentRooms, newRoom]);
  };

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

    return () => {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    };
  }, [form]);

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form id="customerForm" onSubmit={fullSubmit}>
            <AuthenticityTokenInput />
            <div className="">
              <div className="flex flex-row gap-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <InputItem
                      name={"Customer Name"}
                      placeholder={"Enter customer name"}
                      field={field}
                      formClassName="mb-0 w-1/2"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="seller_id"
                  render={({ field }) => (
                    <SelectInput
                      name={"Sales Rep"}
                      field={field}
                      options={salesReps.map((rep) => ({
                        key: rep.id,
                        value: rep.name,
                      }))}
                      placeholder="Select sales rep"
                      className="mb-0 w-1/2"
                    />
                  )}
                />
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
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="same_address"
                      label="Project address same as billing address"
                    />
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
                    <PhoneInput field={field} formClassName="mb-0 w-1/2" />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <EmailInput field={field} formClassName="mb-0" />
                  )}
                />
              </div>

              {/* Builder checkbox */}
              <div className="flex items-center space-x-2 my-2">
                <FormField
                  control={form.control}
                  name="builder"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="builder_checkbox"
                      label="Builder"
                    />
                  )}
                />
              </div>

              {form.watch("builder") && (
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <InputItem
                      name={"Company Name"}
                      placeholder={"Enter company name"}
                      field={field}
                      formClassName="mb-2"
                    />
                  )}
                />
              )}

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
                  stoneId={stoneId}
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

            <DialogFooter className="flex flex-col sm:flex-row gap-2 !justify-between mt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  navigate(`../unsell/${params.saleId}${location.search}`)
                }
                className="sm:order-1 order-2"
              >
                Unsell
              </Button>
              <LoadingButton
                loading={isSubmitting}
                className="sm:order-2 order-1"
                type="submit"
              >
                Update Sale
              </LoadingButton>
            </DialogFooter>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
