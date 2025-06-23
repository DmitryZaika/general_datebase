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
import { customerSchema, TCustomerSchema } from "~/schemas/sales";
import { Sink, Faucet } from "~/types";
import { ContractForm } from "~/components/pages/ContractForm";
import { getCustomerSchemaFromSaleId } from "~/utils/contractsBackend.server";

const resolver = zodResolver(customerSchema);

export async function action({ request, params }: ActionFunctionArgs) {
  // ------------------------------------------------------------
  // Edit existing sale logic (replaces old create-sale action)
  // ------------------------------------------------------------

  // 1. Auth & CSRF
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

  // 2. Parse & validate form data
  const { errors, data, receivedValues } =
    await getValidatedFormData<TCustomerSchema>(request, resolver);
  if (errors) {
    return { errors, receivedValues };
  }

  if (!params.saleId) {
    return { error: "Sale ID is missing" };
  }

  const saleId = Number(params.saleId);
  if (isNaN(saleId)) {
    return { error: "Invalid Sale ID" };
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  try {
    // ----------------------
    // Customer handling
    // ----------------------
    let customerId: number;
    if (data.customer_id) {
      customerId = data.customer_id;

      // Update basic customer fields if provided (and only if blank before)
      const [customerVerify] = await db.execute<RowDataPacket[]>(
        `SELECT id, address, phone, email FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, user.company_id]
      );

      if (!customerVerify || customerVerify.length === 0) {
        throw new Error("Customer not found");
      }

      const updateFields: string[] = [];
      const updateValues: (string | number | null)[] = [];

      if (data.billing_address && (!customerVerify[0].address || customerVerify[0].address === "")) {
        updateFields.push("address = ?");
        updateValues.push(data.billing_address);
      }
      if (data.phone && (!customerVerify[0].phone || customerVerify[0].phone === "")) {
        updateFields.push("phone = ?");
        updateValues.push(data.phone);
      }
      if (data.email && (!customerVerify[0].email || customerVerify[0].email === "")) {
        updateFields.push("email = ?");
        updateValues.push(data.email);
      }

      if (updateFields.length > 0) {
        await db.execute(
          `UPDATE customers SET ${updateFields.join(", ")} WHERE id = ? AND company_id = ?`,
          [...updateValues, customerId, user.company_id]
        );
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

    // ----------------------
    // Update sales table
    // ----------------------
    const totalSquareFeet = data.rooms.reduce(
      (sum, room) => sum + (room.square_feet || 0),
      0
    );

    await db.execute(
      `UPDATE sales SET customer_id = ?, seller_id = ?, notes = ?, square_feet = ?, price = ?, project_address = ? WHERE id = ? AND company_id = ?`,
      [
        customerId,
        user.id,
        data.notes_to_sale || null,
        totalSquareFeet,
        data.price || 0,
        data.project_address || null,
        saleId,
        user.company_id,
      ]
    );

    // ----------------------
    // Handle slabs and accessories
    // ----------------------

    // Get all slab ids currently associated with the sale
    const [allSlabsRows] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM slab_inventory WHERE sale_id = ?`,
      [saleId]
    );
    const allSlabIds: number[] = allSlabsRows.map((r: any) => r.id);

    if (allSlabIds.length) {
      const placeholders = allSlabIds.map(() => "?").join(",");

      // Clear current sink / faucet assignments so we can re-apply
      await db.execute(
        `UPDATE sinks SET slab_id = NULL WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
        allSlabIds
      );
      await db.execute(
        `UPDATE faucets SET slab_id = NULL WHERE slab_id IN (${placeholders}) AND is_deleted = 0`,
        allSlabIds
      );
    }

    // Update each slab record and reassign sinks/faucets according to form
    for (const room of data.rooms) {
      for (const slab of room.slabs) {
        await db.execute(
          `UPDATE slab_inventory SET room_uuid = UUID_TO_BIN(?), seam = ?, edge = ?, room = ?, backsplash = ?, tear_out = ?, square_feet = ?, stove = ?, ten_year_sealer = ?, waterfall = ?, corbels = ?, price = ?, extras = ? WHERE id = ?`,
          [
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

        // Reassign sinks
        for (const sinkType of room.sink_type) {
          await db.execute(
            `UPDATE sinks SET slab_id = ? WHERE sink_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
            [slab.id, sinkType.id]
          );
        }

        // Reassign faucets
        for (const faucetType of room.faucet_type) {
          await db.execute(
            `UPDATE faucets SET slab_id = ? WHERE faucet_type_id = ? AND slab_id IS NULL AND is_deleted = 0 LIMIT 1`,
            [slab.id, faucetType.id]
          );
        }
      }
    }
  } catch (error) {
    console.error("Error updating sale: ", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to update sale"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  // Success toast & redirect
  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", toastData("Success", "Sale updated successfully"));

  return redirect(`..${searchString}`, {
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
    if (!params.saleId) {
      throw new Error("Sale ID is missing");
    }
    const saleId = parseInt(params.saleId, 10);

    const starting = await getCustomerSchemaFromSaleId(saleId);
    if (!starting) {
      return redirect(`/employee/stones/slabs`);
    }

    return { saleId, starting };
};

export default function SlabSell() {
  const data = useLoaderData<typeof loader>();
  const starting = customerSchema.parse(data.starting);
  return <ContractForm starting={starting}/>
}
