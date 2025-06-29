import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router";
import { getValidatedFormData } from "remix-hook-form";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";
import { customerSchema, roomSchema, slabOptionsSchema, TCustomerSchema } from "~/schemas/sales";
import { ContractForm } from "~/components/pages/ContractForm";



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
        data.project_address || data.billing_address
      ]
    );
   

    saleId = salesResult.insertId;
   
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        for (const slab of room.slabs) {
         
          await db.execute(
            `UPDATE slab_inventory SET sale_id = ?, room_uuid = UUID_TO_BIN(?), seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?,
            stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ? WHERE id = ?`,
            [
              saleId,
              room.room_id,
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
              room.retail_price,
              room.extras,
              slab.id,
            ]
          );
         
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
          if (!slab.is_full) {
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

    // If this is a builder sale, update company_name only on customer record
    if (data.builder && data.company_name) {
      await db.execute(
        `UPDATE customers SET company_name = ? WHERE id = ?`,
        [data.company_name, customerId]
      );
    }

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sale completed successfully"));

  const separator = searchString ? "&" : "?";
  return redirect(`..${searchString}${separator}saleId=${saleId}`, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  let user;
  try {
    user = await getEmployeeUser(request);
    } catch (error) {
      return redirect(`/login?error=${error}`);
    }

    if (!params.slab) {
      throw new Error("Slab ID is missing");
    }
    const slabId = parseInt(params.slab, 10);

    return { slabId };
  
};

export default function SlabSell() {
  const { slabId } = useLoaderData<typeof loader>();
  const starting = {
    same_address: true,
    builder:false,
    rooms: [roomSchema.parse({
      slabs: [slabOptionsSchema.parse({
        id: slabId,
        is_full: false
      })]
    })],
  };
  return <ContractForm starting={starting}/>
}
