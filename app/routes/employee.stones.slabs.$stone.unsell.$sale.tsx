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
    // Найти все ID слэбов, которые связаны с этой продажей
    const [slabsToUnsell] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM slab_inventory WHERE sale_id = ?",
      [params.sale]
    );

    console.log(`Found ${slabsToUnsell.length} slabs to unsell:`, JSON.stringify(slabsToUnsell));

    // Удалить все непроданные дочерние слэбы для каждого слэба из продажи
    if (slabsToUnsell && slabsToUnsell.length > 0) {
      for (const slabRow of slabsToUnsell) {
        const parentId = slabRow.id;
        console.log(`Checking for children of slab ID ${parentId}`);
        
        // Check for all child slabs that don't have a sale (are unsold)
        const [childSlabs] = await db.execute<RowDataPacket[]>(
          "SELECT id FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0)",
          [parentId]
        );
        
        console.log(`Found ${childSlabs.length} unpurchased child slabs for parent ID ${parentId}`);
        
        if (childSlabs && childSlabs.length > 0) {
          // Delete all unsold child slabs of this parent
          const [result] = await db.execute<ResultSetHeader>(
            "DELETE FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0)",
            [parentId]
          );
          console.log(`Deleted ${result.affectedRows} unpurchased child slabs of parent ID ${parentId}`);
        }
      }
    }

    // Отменить продажу для всех слэбов в этой продаже
    const [updateResult] = await db.execute<ResultSetHeader>(
      "UPDATE slab_inventory SET sale_id = NULL, notes = NULL, square_feet = NULL WHERE sale_id = ?",
      [params.sale]
    );
    
    console.log(`Updated ${updateResult.affectedRows} slabs to remove sale information`);
    
    // Отменить привязку раковин к этой продаже
    await db.execute(
      "UPDATE sinks SET sale_id = NULL, is_deleted = 0, price = NULL WHERE sale_id = ?",
      [params.sale]
    );
    
    // Отметить продажу как отмененную
    await db.execute(
      "UPDATE sales SET cancelled_date = NOW() WHERE id = ?",
      [params.sale]
    );
 
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab marked as unsold and child slabs removed"));
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
