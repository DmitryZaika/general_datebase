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
import { selectMany } from "~/utils/queryHelpers";
import { customerSchema, roomSchema, slabOptionsSchema, TCustomerSchema } from "~/schemas/sales";
import { Sink, Faucet } from "~/types";
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

    return {
      sink_type,
      faucet_type,
      slabId,
    };
  
};

export default function SlabSell() {
  const data = useLoaderData<typeof loader>();
  const starting = {
    same_address: true,
    rooms: [roomSchema.parse({
      slabs: [slabOptionsSchema.parse({
        id: data.slabId,
        is_full: false
      })]
    })],
  };
  return <ContractForm data={data} starting={starting}/>
}
