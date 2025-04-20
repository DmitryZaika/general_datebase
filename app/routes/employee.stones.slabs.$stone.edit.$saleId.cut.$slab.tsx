import {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  redirect,
  useLoaderData,
  Form,
  useNavigation,
  useNavigate,
} from "react-router";
import { getEmployeeUser } from "~/utils/session.server";
import { forceRedirectError, toastData } from "~/utils/toastHelpers";
import { commitSession, getSession } from "~/sessions";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { csrf } from "~/utils/csrf.server";
import { RowDataPacket } from "mysql2";

interface SlabDetails {
  id: number;
  stone_id: number;
  bundle: string;
  stone_name: string;
  is_cut: number;
  notes: string | null;
  square_feet: number | null;
  length: number | null;
  width: number | null;
  sale_id: number | null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  
  
  const saleId = params.saleId;
  const slabId = params.slab; 
  
  if (!slabId || !saleId) {
    return forceRedirectError(request.headers, "Missing required parameters");
  }
  
  const slabIdNum = parseInt(slabId, 10);
  const saleIdNum = parseInt(saleId, 10);
  
  if (isNaN(slabIdNum) || isNaN(saleIdNum)) {
    return forceRedirectError(request.headers, "Invalid ID format");
  }
  
  const slabs = await selectMany<SlabDetails>(
    db,
    `SELECT 
      slab_inventory.id, slab_inventory.stone_id, slab_inventory.bundle, 
      stones.name as stone_name, slab_inventory.is_cut, 
      slab_inventory.notes, slab_inventory.square_feet,
      slab_inventory.length, slab_inventory.width, slab_inventory.sale_id
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.id = ?`,
    [slabIdNum]
  );
  
  
  if (slabs.length === 0) {
    return forceRedirectError(request.headers, "Slab not found");
  }
  
  const actualStoneId = slabs[0].stone_id;
  
  return { 
    slab: slabs[0],
    stoneId: String(actualStoneId), 
    saleId: saleIdNum,
    slabId: slabIdNum
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const stoneId = params.stone; 
  const saleId = params.saleId;
  const slabId = params.slab; 
  
  if (!stoneId || !saleId || !slabId) {
    return forceRedirectError(request.headers, "Missing required parameters");
  }
  
  const slabIdNum = parseInt(slabId, 10);
  const saleIdNum = parseInt(saleId, 10);
  
  if (isNaN(slabIdNum) || isNaN(saleIdNum)) {
    return forceRedirectError(request.headers, "Invalid ID format");
  }
  
  try {
    await csrf.validate(request);
  } catch (error) {
    console.error("CSRF validation error:", error);
    return { error: "Invalid CSRF token" };
  }
  
  const formData = await request.formData();
  const length = parseFloat(formData.get("length") as string);
  const width = parseFloat(formData.get("width") as string);
  const addAnother = formData.get("addAnother") === "true";
  
  if (isNaN(length) || isNaN(width) || length <= 0 || width <= 0) {
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Please provide valid dimensions"));
    return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleIdNum}/cut/${slabIdNum}`, {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  }

  try {    
    const [slabResult] = await db.execute<RowDataPacket[]>(
      `SELECT id, stone_id, bundle, sale_id, notes, url, is_cut FROM slab_inventory WHERE id = ?`,
      [slabIdNum]
    );
    
    if (!slabResult || slabResult.length === 0) {
      throw new Error("Slab not found");
    }
    
    const originalSlab = slabResult[0];
    const actualStoneId = originalSlab.stone_id;
    
  
    
    if (originalSlab.is_cut !== 1) {
      await db.execute(
        `UPDATE slab_inventory SET is_cut = 1 WHERE id = ?`,
        [slabIdNum]
      );
    }
    
    const [insertResult] = await db.execute<RowDataPacket[] & { insertId: number }>(
      `INSERT INTO slab_inventory 
      (stone_id, bundle, length, width, parent_id, sale_id, url) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actualStoneId,
        originalSlab.bundle,
        length,
        width,
        slabIdNum,
        null, 
        originalSlab.url
      ]
    );
    
    
    if (!addAnother) {
      await db.execute(
        `UPDATE slab_inventory 
         SET sale_id = NULL, notes = NULL 
         WHERE parent_id = ? AND id != ?`,
        [slabIdNum, insertResult.insertId]
      );
    }
    
      const [remainingSlabsResult] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM slab_inventory 
       WHERE sale_id = ? AND (is_cut = 0 OR is_cut IS NULL)`,
      [saleIdNum]
    );
    
    const remainingSlabsCount = remainingSlabsResult[0].count;
    
    const cutType = remainingSlabsCount > 0 ? "partially cut" : "cut";
    await db.execute(
      `UPDATE sales SET status = ? WHERE id = ?`,
      [cutType, saleIdNum]
    );
    
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Success", "Slab cut successfully"));
    
    if (addAnother) {
      
      return redirect(`/employee/stones/slabs/${stoneId}/edit/${saleIdNum}/cut/${slabIdNum}`, {
        headers: { "Set-Cookie": await commitSession(session) }
      });
    } 
      
      return redirect(`/employee/stones/slabs/${actualStoneId}/edit/${saleIdNum}`, {
        headers: { "Set-Cookie": await commitSession(session) }
      });
    
    
  } catch (error) {
    console.error("Error cutting slab:", error);
    
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("message", toastData("Error", "Failed to cut slab"));
    
    const [slabRecord] = await db.execute<RowDataPacket[]>(
      `SELECT stone_id FROM slab_inventory WHERE id = ?`,
      [slabIdNum]
    );
    
    let actualStoneIdForError = stoneId;
    if (slabRecord && slabRecord.length > 0) {
      actualStoneIdForError = String(slabRecord[0].stone_id);
    }
    
    return redirect(`/employee/stones/slabs/${actualStoneIdForError}/edit/${saleIdNum}/cut/${slabIdNum}`, {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  } 
}

export default function CutSlab() {
  const { slab, stoneId, saleId, slabId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isSubmitting = useNavigation().state !== "idle";
  const formRef = useRef<HTMLFormElement>(null);
  
 
  
  useEffect(() => {
    if (!isSubmitting && formRef.current) {
      formRef.current.reset();
    }
  }, [isSubmitting]);
  
  const handleDialogClose = () => {
    navigate(`/employee/stones/slabs/${stoneId}/edit/${saleId}`);
  };
  
  const isAlreadyCut = slab?.is_cut === 1;
  
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) handleDialogClose();
      }}
    >
      <DialogContent className="bg-white rounded-lg pt-4 px-4 shadow-lg text-gray-800 max-w-md">
        <DialogHeader className="mb-3 pb-2 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Cut Slab: {slab.stone_name} - {slab.bundle}
          </DialogTitle>
          {isAlreadyCut && (
            <div className="text-amber-600 text-sm mt-1">
              This slab has already been cut. Adding more pieces.
            </div>
          )}
        </DialogHeader>
        
        <Form method="post" className="space-y-4" ref={formRef}>
          <AuthenticityTokenInput />
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the dimensions of the piece you're cutting off. This will create a new slab piece with the specified dimensions.
            </p>
            
            <p className="text-xs text-gray-500">
              • <strong>Save</strong>: Creates one piece with the entered dimensions and returns to the edit page.<br />
              • <strong>Add Piece</strong>: Creates a piece and allows you to add more pieces.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length
                </label>
                <input
                  type="number"
                  name="length"
                  step="1"
                  min="0"
                  required
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width
                </label>
                <input
                  type="number"
                  name="width"
                  step="1"
                  min="0"
                  required
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-3 border-t border-gray-200 space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleDialogClose}
              disabled={isSubmitting}
              className="text-sm font-medium"
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              name="addAnother"
              value="true"
              variant="default"
              disabled={isSubmitting}
              className="text-sm font-medium"
            >
              Add Piece {isAlreadyCut ? "(again)" : ""}
            </Button>
            
            <LoadingButton 
              loading={isSubmitting} 
              type="submit"
              name="addAnother"
              value="false"
            >
              Save
            </LoadingButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
