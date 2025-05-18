import { ActionFunctionArgs, data, redirect, useLocation,  } from "react-router";
import {  useNavigate } from "react-router";
import { DeleteRow } from "~/components/pages/DeleteRow";


import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import {  forceRedirectError, toastData } from "~/utils/toastHelpers";
import {  getEmployeeUser } from "~/utils/session.server";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export async function action({ params, request }: ActionFunctionArgs) {
  await getEmployeeUser(request);
  if (!params.sale) {
    return forceRedirectError(request.headers, "No stone id provided");
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : '';

  try {
    // Find all slabs linked to this sale
    const [slabsToUnsell] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM slab_inventory WHERE sale_id = ?",
      [params.sale]
    );

    // Process all slabs that are being unsold
    if (slabsToUnsell && slabsToUnsell.length > 0) {
      for (const slabRow of slabsToUnsell) {
        const parentId = slabRow.id;
        
        // Check if this slab has any sold child slabs
        const [soldChildSlabs] = await db.execute<RowDataPacket[]>(
          "SELECT id FROM slab_inventory WHERE parent_id = ? AND sale_id IS NOT NULL",
          [parentId]
        );
        
        if (soldChildSlabs && soldChildSlabs.length > 0) {
          // If parent and child are both sold, remove parent_id from children and delete parent
          await db.execute(
            "UPDATE slab_inventory SET parent_id = NULL WHERE parent_id = ?",
            [parentId]
          );
          
          // Delete the parent slab (this is the new behavior we want)
          await db.execute(
            "DELETE FROM slab_inventory WHERE id = ?",
            [parentId]
          );
        } else {
          // Check for unsold child slabs
          const [unsoldChildSlabs] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '')",
            [parentId]
          );
          
          if (unsoldChildSlabs && unsoldChildSlabs.length > 0) {
            // Delete all unsold child slabs of this parent
            await db.execute(
              "DELETE FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '')",
              [parentId]
            );
          }
        }
      }
    }
    
    // Additional cleanup step - delete all unsold slabs with the same bundle
    const [bundleInfo] = await db.execute<RowDataPacket[]>(
      "SELECT DISTINCT bundle, stone_id FROM slab_inventory WHERE sale_id = ?",
      [params.sale]
    );
    
    if (bundleInfo && bundleInfo.length > 0) {
      for (const info of bundleInfo) {
        const bundle = info.bundle;
        const stoneId = info.stone_id;
        
        // Delete all unsold slabs with the same bundle in the same stone
        await db.execute(
          `DELETE FROM slab_inventory 
           WHERE bundle = ? 
           AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '') 
           AND stone_id = ?`,
          [bundle, stoneId]
        );
      }
    }

    // Mark remaining slabs as unsold
    await db.execute(
      "UPDATE slab_inventory SET sale_id = NULL, notes = NULL, square_feet = NULL WHERE sale_id = ?",
      [params.sale]
    );
    
    // Unsell sinks from this sale
    await db.execute(
      "UPDATE sinks SET sale_id = NULL, is_deleted = 0, price = NULL WHERE sale_id = ?",
      [params.sale]
    );
    
    // Mark the sale as cancelled
    await db.execute(
      "UPDATE sales SET cancelled_date = NOW() WHERE id = ?",
      [params.sale]
    );
 
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Transaction canceled, slabs processed successfully"));
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
  return (<DeleteRow 
            handleChange={handleChange}
            title='Cancel Transaction'
            description={`Are you sure you want to cancel the transaction?`}
          />);
}
