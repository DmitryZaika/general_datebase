import { ActionFunctionArgs, data, redirect, useLocation } from "react-router";
import { useNavigate } from "react-router";
import { DeleteRow } from "~/components/pages/DeleteRow";

import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { getEmployeeUser } from "~/utils/session.server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export async function action({ params, request }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.sale) {
    return forceRedirectError(request.headers, "No stone id provided");
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  try {
    // STEP 1: Unsell sinks and faucets - remove slab_id to make them available again
    await db.execute(
      "UPDATE sinks SET slab_id = NULL, is_deleted = 0, price = NULL WHERE slab_id IN (SELECT id FROM slab_inventory WHERE sale_id = ?)",
      [params.sale]
    );
    await db.execute(
      "UPDATE faucets SET slab_id = NULL, is_deleted = 0, price = NULL WHERE slab_id IN (SELECT id FROM slab_inventory WHERE sale_id = ?)",
      [params.sale]
    );

    // STEP 2: Get all slabs that are being unsold (parents)
    const [parentSlabs] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM slab_inventory WHERE sale_id = ?",
      [params.sale]
    );

    // STEP 3: Delete unsold children for each parent being unsold
    if (parentSlabs && parentSlabs.length > 0) {
      for (const parent of parentSlabs) {
        // Delete child slabs that are NOT sold (sale_id IS NULL)
        await db.execute(
          "DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL",
          [parent.id]
        );
      }
    }

    // STEP 4: Clear all sale information from slabs - remove sale_id and all room/sale data
    await db.execute(
      `UPDATE slab_inventory SET 
        sale_id = NULL, 
        notes = NULL, 
        price = NULL,
        square_feet = NULL,
        edge = NULL,
        room = NULL,
        backsplash = NULL,
        tear_out = NULL,
        ten_year_sealer = NULL,
        waterfall = NULL,
        corbels = NULL,
        seam = NULL,
        stove = NULL
      WHERE sale_id = ?`,
      [params.sale]
    );

    // Mark the sale as cancelled
    await db.execute("UPDATE sales SET cancelled_date = NOW() WHERE id = ?", [
      params.sale,
    ]);

    const session = await getSession(request.headers.get("Cookie"));
    session.flash(
      "message",
      toastData("Success", "Transaction canceled, slabs processed successfully")
    );
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  } catch (error) {
    console.error("Error unselling slab:", error);
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to unsell slab"));
    return redirect(`..${searchString}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }
}

export default function SupportsAdd() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (open: boolean) => {
    if (open === false) {
      navigate(`..${location.search}`);
    }
  };
  return (
    <DeleteRow
      handleChange={handleChange}
      title="Cancel Transaction"
      description={`Are you sure you want to cancel the transaction?`}
    />
  );
}
